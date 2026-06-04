"""Presentation check service.

Accepts a URL to a PPTX or PDF presentation. Validates:
- slide count
- presence of required sections (per TZ section 4)
"""
from __future__ import annotations

import io
import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

REQUIRED_SECTIONS = {
    "problem": ["проблема", "problem"],
    "solution": ["решение", "solution"],
    "audience": ["целевая аудитория", "аудитория", "target audience", "audience"],
    "stack": ["стек", "технологический стек", "tech stack", "технологии", "stack"],
    "demo": ["демо", "demo"],
    "team": ["команда", "team"],
    "contacts": ["контакты", "contacts"],
}


def _fetch(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(url)
            r.raise_for_status()
            return r.content
    except Exception as exc:
        logger.warning("presentation fetch failed %s: %s", url, exc)
        return None


def _fmt(url: str) -> str:
    p = urlparse(url).path.lower()
    if p.endswith(".pdf"):
        return "pdf"
    return "pptx"


def _slides_pdf(data: bytes) -> list[str]:
    try:
        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(data))
        return [(p.extract_text() or "") for p in reader.pages]
    except Exception as exc:
        logger.warning("pdf slide extract failed: %s", exc)
        return []


def _slides_pptx(data: bytes) -> list[str]:
    try:
        from pptx import Presentation  # type: ignore

        prs = Presentation(io.BytesIO(data))
        out: list[str] = []
        for slide in prs.slides:
            chunks: list[str] = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        for run in para.runs:
                            if run.text:
                                chunks.append(run.text)
            out.append("\n".join(chunks))
        return out
    except Exception as exc:
        logger.warning("pptx extract failed: %s", exc)
        return []


def _section_hits(slides_text: list[str]) -> list[str]:
    joined = "\n".join(slides_text).lower()
    found: list[str] = []
    for name, keys in REQUIRED_SECTIONS.items():
        if any(k in joined for k in keys):
            found.append(name)
    return found


def run_presentation_check(url: str | None) -> dict:
    if not url:
        return {
            "status": "skipped",
            "score": 0.0,
            "slide_count": 0,
            "sections_found": [],
            "fmt": "",
            "message": "no presentation url provided",
        }
    data = _fetch(url)
    if not data:
        return {
            "status": "error",
            "score": 0.0,
            "slide_count": 0,
            "sections_found": [],
            "fmt": _fmt(url),
            "message": "failed to fetch presentation",
        }
    fmt = _fmt(url)
    if fmt == "pdf":
        slides = _slides_pdf(data)
    else:
        slides = _slides_pptx(data)
    count = len(slides)
    found = _section_hits(slides)
    score = 0.0
    if 8 <= count <= 15:
        score += 3.0
    elif 5 <= count <= 20:
        score += 1.5
    score += min(7.0, len(found) * 1.0)
    score = min(10.0, round(score, 2))

    return {
        "status": "done",
        "score": score,
        "slide_count": count,
        "sections_found": found,
        "fmt": fmt,
        "message": "ok",
    }
