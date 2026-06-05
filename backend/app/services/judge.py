"""Algorithm judge.

Runs a participant's submission in a subprocess with hard limits:
- time: rlimit CPU (seconds) [POSIX only; on Windows we fall back to wall clock]
- memory: rlimit AS (bytes) [POSIX only; on Windows we approximate from output cap]
- output cap: 1 MB
- wall clock: hard cap (seconds * 4)

Verdicts per TZ: OK, WA, TL, ML, RE, CE.
Compile step is run for C++/Java; for Python we just `python <file>`.
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from app.core.config import settings

VERDICT_OK = "OK"
VERDICT_WA = "WA"
VERDICT_TL = "TL"
VERDICT_ML = "ML"
VERDICT_RE = "RE"
VERDICT_CE = "CE"

_IS_POSIX = os.name == "posix"
if _IS_POSIX:
    import resource

def _preexec(child_stderr_path: str):
    def _pre():
        if not _IS_POSIX:
            return
        os.setsid()
        try:
            resource.setrlimit(
                resource.RLIMIT_CPU,
                (settings.judge_time_limit_sec, settings.judge_time_limit_sec + 1),
            )
            mem_bytes = settings.judge_memory_limit_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except Exception:
            pass

    return _pre

def _compile(cmd: list[str], cwd: str, timeout: int = 30) -> tuple[bool, str]:
    try:
        out = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return False, "compile timeout"
    except FileNotFoundError as exc:
        return False, f"compiler not found: {exc}"
    if out.returncode != 0:
        return False, (out.stderr or out.stdout or "compile error")[:2000]
    return True, ""

def _normalize(s: str) -> str:
    return s.replace("\r\n", "\n").rstrip()

def _verdict_for_output(expected: str, actual: str) -> str:
    return VERDICT_OK if _normalize(expected) == _normalize(actual) else VERDICT_WA

def _max_rss_mb() -> float:
    if not _IS_POSIX:
        return 0.0
    try:
        usage = resource.getrusage(resource.RUSAGE_CHILDREN)
        return round(usage.ru_maxrss / 1024.0, 2)
    except Exception:
        return 0.0

def judge_submission(
    code: str,
    language: str,
    tests: list[dict],
    time_limit_ms: int,
    memory_limit_mb: int,
) -> list[dict]:
    """Run the submission against the list of tests.

    Each test is `{"input_data": str, "expected_output": str}`.
    Returns a list of per-test result dicts: `{verdict, runtime_ms, memory_mb, output, log}`.
    """
    results: list[dict] = []
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        if language == "python":
            src = tmpdir / "main.py"
            src.write_text(code, encoding="utf-8")
        elif language == "cpp":
            src = tmpdir / "main.cpp"
            src.write_text(code, encoding="utf-8")
            ok, err = _compile(["g++", "-O2", "-std=c++17", "-o", "main", "main.cpp"], cwd=tmp)
            if not ok:
                return [
                    {
                        "verdict": VERDICT_CE,
                        "runtime_ms": 0,
                        "memory_mb": 0.0,
                        "output": "",
                        "log": err,
                    }
                    for _ in tests
                ]
        elif language == "java":
            (tmpdir / "Main.java").write_text(code, encoding="utf-8")
            ok, err = _compile(["javac", "Main.java"], cwd=tmp, timeout=30)
            if not ok:
                return [
                    {
                        "verdict": VERDICT_CE,
                        "runtime_ms": 0,
                        "memory_mb": 0.0,
                        "output": "",
                        "log": err,
                    }
                    for _ in tests
                ]
        else:
            return [
                {
                    "verdict": VERDICT_CE,
                    "runtime_ms": 0,
                    "memory_mb": 0.0,
                    "output": "",
                    "log": f"unsupported language: {language}",
                }
                for _ in tests
            ]

        cpu_limit = max(1, int(round(time_limit_ms / 1000.0)) or 1)
        wall_limit = max(2, cpu_limit * 4)
        mem_bytes = memory_limit_mb * 1024 * 1024

        for test in tests:
            inp = test["input_data"]
            expected = test["expected_output"]
            stdin_path = tmpdir / "in.txt"
            stdout_path = tmpdir / "out.txt"
            stderr_path = tmpdir / "err.txt"
            stdin_path.write_text(inp, encoding="utf-8")

            if language == "python":
                cmd = [sys.executable, str(src)]
            elif language == "cpp":
                cmd = ["./main"]
            else:
                cmd = ["java", "-Xmx" + f"{memory_limit_mb}m", "Main"]

            t0 = time.perf_counter()
            try:
                with stdin_path.open("rb") as sin, stdout_path.open("wb") as sout, stderr_path.open(
                    "wb"
                ) as serr:
                    popen_kwargs: dict = {"cwd": tmp, "stdin": sin, "stdout": sout, "stderr": serr}
                    if _IS_POSIX:
                        popen_kwargs["preexec_fn"] = _preexec(str(stderr_path))
                    proc = subprocess.Popen(cmd, **popen_kwargs)
                    try:
                        proc.wait(timeout=wall_limit)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                        runtime_ms = int((time.perf_counter() - t0) * 1000)
                        results.append(
                            {
                                "verdict": VERDICT_TL,
                                "runtime_ms": runtime_ms,
                                "memory_mb": 0.0,
                                "output": "",
                                "log": "wall timeout",
                            }
                        )
                        continue
                runtime_ms = int((time.perf_counter() - t0) * 1000)
            except Exception as exc:
                results.append(
                    {
                        "verdict": VERDICT_RE,
                        "runtime_ms": int((time.perf_counter() - t0) * 1000),
                        "memory_mb": 0.0,
                        "output": "",
                        "log": f"runner error: {exc}",
                    }
                )
                continue

            mem_mb = _max_rss_mb()
            err = stderr_path.read_text(encoding="utf-8", errors="ignore") if stderr_path.exists() else ""
            out = stdout_path.read_text(encoding="utf-8", errors="ignore") if stdout_path.exists() else ""
            if len(out) > 1_000_000:
                results.append(
                    {
                        "verdict": VERDICT_RE,
                        "runtime_ms": runtime_ms,
                        "memory_mb": mem_mb,
                        "output": out[:1024],
                        "log": "output too large",
                    }
                )
                continue

            exit_code = proc.returncode
            if exit_code != 0:
                if mem_mb * 1024 * 1024 > mem_bytes:
                    results.append(
                        {
                            "verdict": VERDICT_ML,
                            "runtime_ms": runtime_ms,
                            "memory_mb": mem_mb,
                            "output": out,
                            "log": err,
                        }
                    )
                else:
                    results.append(
                        {
                            "verdict": VERDICT_RE,
                            "runtime_ms": runtime_ms,
                            "memory_mb": mem_mb,
                            "output": out,
                            "log": err,
                        }
                    )
                continue

            results.append(
                {
                    "verdict": _verdict_for_output(expected, out),
                    "runtime_ms": runtime_ms,
                    "memory_mb": mem_mb,
                    "output": out,
                    "log": "",
                }
            )
    return results
