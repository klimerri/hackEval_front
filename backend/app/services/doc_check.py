"""Documentation check service.

Accepts URL to PDF, DOCX, or Markdown. Downloads (with limits), extracts text
and checks the minimum requirements per TZ section 3.
"""
from __future__ import annotations

import io
import logging
import re
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

MIN_WORDS = 800

DESC_KEYS = ["описание системы", "system description", "описание", "обзор", "overview", "introduction"]
DEPLOY_KEYS = ["развертывание", "deployment", "deploy", "install", "установка"]
USAGE_KEYS = ["эксплуатация", "использование", "usage", "operation", "how to run", "запуск"]


def _fetch(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.content
    except Exception as exc:
        logger.warning("docs fetch failed %s: %s", url, exc)
        return None


def _extract_pdf(data: bytes) -> str:
    try:
        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(data))
        return "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception as exc:
        logger.warning("pdf extract failed: %s", exc)
        return ""


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document  # type: ignore

        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as exc:
        logger.warning("docx extract failed: %s", exc)
        return ""


def _extract_md(data: bytes) -> str:
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _format_from_url(url: str) -> str:
    path = urlparse(url).path.lower()
    if path.endswith(".pdf"):
        return "pdf"
    if path.endswith(".docx"):
        return "docx"
    return "md"


def _has_any(text: str, keys: list[str]) -> bool:
    t = text.lower()
    return any(k in t for k in keys)


def _image_count(text: str) -> int:
    return len(re.findall(r"!\[[^\]]*\]\([^)]+\)", text)) + len(re.findall(r"<img\b", text, flags=re.IGNORECASE))


def run_doc_check(url: str | None) -> dict:
    if not url:
        return {
            "status": "skipped",
            "score": 0.0,
            "word_count": 0,
            "has_description": False,
            "has_deploy": False,
            "has_usage": False,
            "image_count": 0,
            "fmt": "",
            "message": "no docs url provided",
        }
    data = _fetch(url)
    if not data:
        return {
            "status": "error",
            "score": 0.0,
            "word_count": 0,
            "has_description": False,
            "has_deploy": False,
            "has_usage": False,
            "image_count": 0,
            "fmt": _format_from_url(url),
            "message": "failed to fetch docs",
        }
    fmt = _format_from_url(url)
    if fmt == "pdf":
        text = _extract_pdf(data)
    elif fmt == "docx":
        text = _extract_docx(data)
    else:
        text = _extract_md(data)
    words = len(re.findall(r"\b\w+\b", text))
    has_desc = _has_any(text, DESC_KEYS)
    has_deploy = _has_any(text, DEPLOY_KEYS)
    has_usage = _has_any(text, USAGE_KEYS)
    images = _image_count(text)

    score = 0.0
    if has_desc:
        score += 2.5
    if has_deploy:
        score += 2.5
    if has_usage:
        score += 2.5
    if words >= MIN_WORDS:
        score += 1.5
    elif words > 0:
        score += max(0.0, 1.5 * (words / MIN_WORDS))
    if images >= 2:
        score += 1.0
    score = min(10.0, round(score, 2))

    return {
        "status": "done",
        "score": score,
        "word_count": words,
        "has_description": has_desc,
        "has_deploy": has_deploy,
        "has_usage": has_usage,
        "image_count": images,
        "fmt": fmt,
        "message": "ok",
    }
