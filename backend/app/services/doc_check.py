"""Documentation check service.

Accepts a URL or a local file path to PDF, DOCX, or Markdown. Extracts text
and validates the minimum requirements per TZ section 3:
- required sections: system description, deployment, usage;
- minimum volume (word count);
- basic quality: section length, images/diagrams present.
"""
from __future__ import annotations

import io
import logging
import os
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

MIN_WORDS = 800

DESC_KEYS = ["описани", "обзор", "overview", "introduction", "system description"]
DEPLOY_KEYS = ["развёрт", "разверт", "deployment", "deploy", "install", "установ"]
USAGE_KEYS = ["эксплуатац", "использован", "usage", "operation", "how to run", "запуск"]

def _fetch(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.content
    except Exception as exc:
        logger.warning("docs fetch failed %s: %s", url, exc)
        return None

def _load(source: str) -> tuple[bytes | None, str]:
    """Return (bytes, error). Supports local file paths and http(s) URLs."""
    if os.path.exists(source):
        try:
            return Path(source).read_bytes(), ""
        except Exception as exc:
            return None, f"failed to read file: {exc}"
    if not source.lower().startswith(("http://", "https://")):
        return None, "source is neither a local file nor an http(s) url"
    data = _fetch(source)
    if not data:
        return None, "failed to fetch docs"
    return data, ""

def _format_from_source(source: str) -> str:
    path = urlparse(source).path.lower() if "://" in source else source.lower()
    if path.endswith(".pdf"):
        return "pdf"
    if path.endswith(".docx"):
        return "docx"
    return "md"

def _extract_pdf(data: bytes) -> tuple[str, int]:
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        images = 0
        for p in reader.pages:
            try:
                images += len(p.images)
            except Exception:
                pass
        return text, images
    except Exception as exc:
        logger.warning("pdf extract failed: %s", exc)
        return "", 0

def _extract_docx(data: bytes) -> tuple[str, int]:
    try:
        from docx import Document

        doc = Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
        try:
            images = len(doc.inline_shapes)
        except Exception:
            images = 0
        return text, images
    except Exception as exc:
        logger.warning("docx extract failed: %s", exc)
        return "", 0

def _extract_md(data: bytes) -> tuple[str, int]:
    try:
        text = data.decode("utf-8", errors="ignore")
    except Exception:
        return "", 0
    images = len(re.findall(r"!\[[^\]]*\]\([^)]+\)", text)) + len(
        re.findall(r"<img\b", text, flags=re.IGNORECASE)
    )
    return text, images

def _has_any(text: str, keys: list[str]) -> bool:
    t = text.lower()
    return any(k in t for k in keys)

def _skipped(msg: str, fmt: str = "") -> dict:
    return {
        "status": "skipped",
        "score": 0.0,
        "word_count": 0,
        "has_description": False,
        "has_deploy": False,
        "has_usage": False,
        "image_count": 0,
        "fmt": fmt,
        "message": msg,
    }

def run_doc_check(source: str | None) -> dict:
    if not source:
        return _skipped("no docs url or file provided")
    data, err = _load(source)
    fmt = _format_from_source(source)
    if not data:
        return {**_skipped(err or "failed to load docs", fmt), "status": "error"}

    if fmt == "pdf":
        text, images = _extract_pdf(data)
    elif fmt == "docx":
        text, images = _extract_docx(data)
    else:
        text, images = _extract_md(data)

    words = len(re.findall(r"\b\w+\b", text))
    has_desc = _has_any(text, DESC_KEYS)
    has_deploy = _has_any(text, DEPLOY_KEYS)
    has_usage = _has_any(text, USAGE_KEYS)

    score = 0.0
    if has_desc:
        score += 2.0
    if has_deploy:
        score += 2.0
    if has_usage:
        score += 2.0
    if words >= MIN_WORDS:
        score += 2.0
    elif words > 0:
        score += round(2.0 * (words / MIN_WORDS), 2)
    if images >= 2:
        score += 2.0
    elif images == 1:
        score += 1.0
    score = min(10.0, round(score, 2))

    missing = [
        name
        for name, ok in (("описание", has_desc), ("развёртывание", has_deploy), ("эксплуатация", has_usage))
        if not ok
    ]
    msg = "ok" if not missing else "нет разделов: " + ", ".join(missing)

    return {
        "status": "done",
        "score": score,
        "word_count": words,
        "has_description": has_desc,
        "has_deploy": has_deploy,
        "has_usage": has_usage,
        "image_count": images,
        "fmt": fmt,
        "message": msg,
    }
