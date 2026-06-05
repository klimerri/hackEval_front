"""Manually run the code check against a Git/zip URL or a local .zip archive.

Usage (no DB / Celery needed):

    python -m scripts.check_repo https://github.com/octocat/Hello-World
    python -m scripts.check_repo https://github.com/owner/repo/archive/refs/heads/main.zip
    python -m scripts.check_repo /path/to/project.zip

Prints the full CodeCheck report (structure flags, LOC, complexity, pylint
issues, secrets, score). Handy for verifying the static analysis quickly.
"""
from __future__ import annotations

import json
import sys

from app.services.code_check import run_code_check


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = sys.argv[1]
    print(f"Running code check against: {source}\n")
    result = run_code_check(source)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "done" else 1


if __name__ == "__main__":
    raise SystemExit(main())
