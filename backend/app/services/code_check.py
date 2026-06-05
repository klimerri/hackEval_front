"""Code check service.

Validates a Git repository (URL) or an uploaded zip archive (local path)
against a fixed checklist:
- README present
- LICENSE present
- dependency file (requirements.txt / package.json / go.mod / Cargo.toml / pyproject.toml)
- run instructions (in README)
- LOC (lines of code, excluding blanks/comments)
- average cyclomatic complexity (radon if available, else 1.0)
- linter issues (pylint over Python sources, if available)
- secret patterns (regex-based, lightweight)

`source` may be:
- an https URL to a GitHub repo (converted to its archive zip),
- an https URL to a .zip archive,
- a local filesystem path to a .zip archive (uploaded by the team).
"""
from __future__ import annotations

import io
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

MAX_LINT_FILES = 60

DEP_FILES = {
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "setup.py",
    "package.json",
    "yarn.lock",
    "go.mod",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
}

LICENSE_FILES = {"LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"}

README_FILES = {"README.md", "README.rst", "README.txt", "README"}

SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----"),
    re.compile(r"(?i)api[_-]?key\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{16,}"),
    re.compile(r"(?i)password\s*[:=]\s*[\"'][^\"']{6,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"xox[abp]-[A-Za-z0-9-]{10,}"),
]


def _is_github_zip(url: str) -> bool:
    return urlparse(url).netloc.endswith("github.com") and url.endswith(".zip")


def _is_github_repo(url: str) -> bool:
    return urlparse(url).netloc.endswith("github.com")


def _github_zip_url(url: str) -> str:
    if url.endswith(".zip"):
        return url
    return url.rstrip("/") + "/archive/refs/heads/main.zip"


def _fetch_archive(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.content
    except Exception as exc:
        logger.warning("archive fetch failed for %s: %s", url, exc)
        return None


def _iter_zip_files(data: bytes) -> Iterable[tuple[str, bytes]]:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                if info.file_size > 2_000_000:
                    continue
                try:
                    with zf.open(info) as fh:
                        yield info.filename, fh.read()
                except Exception:
                    continue
    except zipfile.BadZipFile:
        return


def _count_loc_and_complexity(contents: list[tuple[str, bytes]]) -> tuple[int, float]:
    loc = 0
    cc_sum = 0.0
    cc_n = 0
    for name, data in contents:
        if not name.endswith((".py", ".js", ".ts", ".go", ".java", ".cpp", ".c", ".cs", ".rb")):
            continue
        try:
            text = data.decode("utf-8", errors="ignore")
        except Exception:
            continue
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or stripped.startswith("//"):
                continue
            loc += 1
        if name.endswith(".py"):
            try:
                import radon.complexity as rc  # type: ignore

                results = rc.cc_visit(text)
                for r in results:
                    cc_sum += r.complexity
                    cc_n += 1
            except Exception:
                pass
    avg_cc = (cc_sum / cc_n) if cc_n else 1.0
    return loc, round(avg_cc, 2)


def _scan_secrets(all_text: str) -> int:
    found = 0
    for pat in SECRET_PATTERNS:
        if pat.search(all_text):
            found += 1
    return found


def _has_run_instructions(readme: str) -> bool:
    if not readme:
        return False
    text = readme.lower()
    keys = ["install", "установка", "quickstart", "getting started", "## run", "## usage", "## запуск"]
    return any(k in text for k in keys)


def _candidate_urls(source: str) -> list[str]:
    """Build the list of archive URLs to try for a given source."""
    if source.endswith(".zip"):
        return [source]
    if _is_github_repo(source):
        base = source.rstrip("/")
        if base.endswith(".git"):
            base = base[:-4]
        # try the common default branches
        return [
            base + "/archive/refs/heads/main.zip",
            base + "/archive/refs/heads/master.zip",
        ]
    return [source]


def _load_archive(source: str) -> tuple[bytes | None, str]:
    """Return (archive_bytes, error). Supports local zip paths and http(s) URLs."""
    # Local uploaded archive
    if os.path.exists(source):
        try:
            return Path(source).read_bytes(), ""
        except Exception as exc:  # pragma: no cover - fs errors
            return None, f"failed to read archive: {exc}"
    if not source.lower().startswith(("http://", "https://")):
        return None, "source is neither a local archive nor an http(s) url"
    for url in _candidate_urls(source):
        data = _fetch_archive(url)
        if data:
            return data, ""
    return None, "failed to fetch archive (check the URL and that the repo is public)"


def _run_pylint(py_files: list[tuple[str, bytes]]) -> int | None:
    """Run pylint over the Python sources. Returns issue count, or None if unavailable.

    Pylint statically analyses the code (it does not execute it). We extract the
    sources to a temp dir, cap the number of files, and parse the JSON report.
    """
    if not py_files:
        return 0
    try:
        with tempfile.TemporaryDirectory() as tmp:
            paths: list[str] = []
            for name, data in py_files[:MAX_LINT_FILES]:
                safe = name.replace("\\", "/").split("/")[-1]
                if not safe.endswith(".py"):
                    continue
                p = Path(tmp) / f"{len(paths)}_{safe}"
                try:
                    p.write_bytes(data)
                    paths.append(str(p))
                except Exception:
                    continue
            if not paths:
                return 0
            proc = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pylint",
                    "--output-format=json",
                    "--score=n",
                    "--disable=import-error,no-name-in-module",
                    *paths,
                ],
                capture_output=True,
                text=True,
                timeout=90,
            )
            out = proc.stdout.strip()
            if out.startswith("["):
                return len(json.loads(out))
            # empty/invalid stdout: distinguish "pylint not installed" from "0 issues"
            if "No module named" in (proc.stderr or ""):
                return None
            return 0
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        logger.warning("pylint timed out")
        return None
    except Exception as exc:
        logger.warning("pylint failed: %s", exc)
        return None


def run_code_check(source: str | None) -> dict:
    """Synchronous code check. Returns a dict ready to be written into CodeCheck.

    `source` is a Git/zip URL or a local path to an uploaded zip archive.
    """
    if not source:
        return {
            "status": "skipped",
            "score": 0.0,
            "has_readme": False,
            "has_license": False,
            "has_deps_file": False,
            "has_run_instructions": False,
            "loc": 0,
            "avg_complexity": 0.0,
            "lint_issues": 0,
            "secrets_found": 0,
            "message": "no repository url or archive provided",
        }
    archive, err = _load_archive(source)
    if not archive:
        return {
            "status": "error",
            "score": 0.0,
            "has_readme": False,
            "has_license": False,
            "has_deps_file": False,
            "has_run_instructions": False,
            "loc": 0,
            "avg_complexity": 0.0,
            "lint_issues": 0,
            "secrets_found": 0,
            "message": err or "failed to load archive",
        }
    files = list(_iter_zip_files(archive))
    names_lower = {n.split("/")[-1].lower() for n, _ in files}
    has_readme = bool({r.lower() for r in README_FILES} & names_lower)
    has_license = bool({r.lower() for r in LICENSE_FILES} & names_lower)
    has_deps = bool({d.lower() for d in DEP_FILES} & names_lower)

    readme_text = ""
    all_text_chunks: list[str] = []
    for n, data in files:
        base = n.split("/")[-1].lower()
        if base in {r.lower() for r in README_FILES} and not readme_text:
            try:
                readme_text = data.decode("utf-8", errors="ignore")
            except Exception:
                pass
        if data and len(data) < 1_000_000:
            try:
                all_text_chunks.append(data.decode("utf-8", errors="ignore"))
            except Exception:
                pass

    has_run = _has_run_instructions(readme_text)
    loc, avg_cc = _count_loc_and_complexity(files)
    secrets = _scan_secrets("\n".join(all_text_chunks))
    py_files = [(n, d) for n, d in files if n.endswith(".py")]
    lint_raw = _run_pylint(py_files)
    lint_available = lint_raw is not None
    lint_issues = lint_raw if lint_available else 0

    score = 0.0
    score += 1.5 if has_readme else 0
    score += 1.0 if has_license else 0
    score += 1.5 if has_deps else 0
    score += 1.0 if has_run else 0
    if loc > 0:
        score += min(1.5, loc / 700)
    if avg_cc > 0:
        score += min(1.5, max(0.0, 1.5 - max(0.0, (avg_cc - 5)) * 0.3))
    if secrets == 0:
        score += 1.0
    else:
        score -= min(2.0, secrets * 0.5)
    # linter: full point at 0 issues, decreasing; neutral half-point if unavailable
    if not lint_available:
        score += 0.5
    elif lint_issues == 0:
        score += 1.0
    else:
        score += max(0.0, 1.0 - min(1.0, lint_issues / 50.0))
    score = max(0.0, min(10.0, score))

    msg_parts = ["ok"]
    if not lint_available:
        msg_parts.append("pylint n/a")
    else:
        msg_parts.append(f"pylint: {lint_issues} issues")
    if py_files:
        msg_parts.append(f"{len(py_files)} py files")

    return {
        "status": "done",
        "score": round(score, 2),
        "has_readme": has_readme,
        "has_license": has_license,
        "has_deps_file": has_deps,
        "has_run_instructions": has_run,
        "loc": loc,
        "avg_complexity": avg_cc,
        "lint_issues": lint_issues,
        "secrets_found": secrets,
        "message": " · ".join(msg_parts),
    }
