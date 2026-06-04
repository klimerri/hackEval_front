"""Code check service.

Validates a Git repository or zip archive against a fixed checklist:
- README present
- LICENSE present
- dependency file (requirements.txt / package.json / go.mod / Cargo.toml / pyproject.toml)
- run instructions (in README)
- LOC (lines of code, excluding blanks/comments)
- average cyclomatic complexity (radon if available, else 1.0)
- secret patterns (regex-based, very lightweight)
"""
from __future__ import annotations

import io
import logging
import re
import zipfile
from typing import Iterable
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

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


def run_code_check(repo_url: str | None) -> dict:
    """Synchronous code check. Returns a dict ready to be written into CodeCheck."""
    if not repo_url:
        return {
            "status": "skipped",
            "score": 0.0,
            "has_readme": False,
            "has_license": False,
            "has_deps_file": False,
            "has_run_instructions": False,
            "loc": 0,
            "avg_complexity": 0.0,
            "secrets_found": 0,
            "message": "no repository url provided",
        }
    url = _github_zip_url(repo_url) if _is_github_repo(repo_url) else repo_url
    archive = _fetch_archive(url)
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
            "secrets_found": 0,
            "message": "failed to fetch archive",
        }
    files = list(_iter_zip_files(archive))
    names_lower = {n.split("/")[-1].lower() for n, _ in files}
    has_readme = bool(README_FILES & {n.lower() for n in names_lower})
    has_license = bool(LICENSE_FILES & {n.lower() for n in names_lower})
    has_deps = bool(DEP_FILES & {n.lower() for n in names_lower})

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

    score = 0.0
    score += 1.5 if has_readme else 0
    score += 1.0 if has_license else 0
    score += 1.5 if has_deps else 0
    score += 1.0 if has_run else 0
    if loc > 0:
        score += min(2.0, loc / 500)
    if avg_cc > 0:
        score += max(0.0, 2.0 - max(0.0, (avg_cc - 5)) * 0.3)
    if secrets == 0:
        score += 1.0
    else:
        score -= min(2.0, secrets * 0.5)
    score = max(0.0, min(10.0, score))

    return {
        "status": "done",
        "score": round(score, 2),
        "has_readme": has_readme,
        "has_license": has_license,
        "has_deps_file": has_deps,
        "has_run_instructions": has_run,
        "loc": loc,
        "avg_complexity": avg_cc,
        "secrets_found": secrets,
        "message": "ok",
    }
