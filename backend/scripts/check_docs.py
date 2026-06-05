"""Manually run the documentation check against a URL or a local file.

Usage (no DB / Celery needed):

    python -m scripts.check_docs scripts/samples/good_docs.md
    python -m scripts.check_docs scripts/samples/bad_docs.md
    python -m scripts.check_docs https://example.com/whitepaper.pdf
    python -m scripts.check_docs /path/to/doc.docx

Prints the full DocCheck report: обязательные разделы (описание/развёртывание/
эксплуатация), объём (слова), изображения, формат, балл.
"""
from __future__ import annotations

import json
import sys

from app.services.doc_check import run_doc_check

def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = sys.argv[1]
    print(f"Running doc check against: {source}\n")
    result = run_doc_check(source)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "done" else 1

if __name__ == "__main__":
    raise SystemExit(main())
