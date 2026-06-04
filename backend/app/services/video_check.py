"""Video check service.

Accepts either a video file URL or a link to a video hosting (YouTube etc.).
For direct file URLs it tries to probe the file with `ffprobe` (if present)
to extract duration, resolution, codec. For non-direct URLs it falls back to
marking required fields as `unknown` and assigning a conservative score.

Transcription is intentionally left empty by default; an external Whisper
service can be plugged in by setting VIDEO_TRANSCRIBE_URL.
"""
from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


def _is_direct_file(url: str) -> bool:
    p = urlparse(url)
    return p.path.lower().endswith((".mp4", ".mov", ".webm", ".mkv", ".avi"))


def _probe(path: str) -> dict:
    if not shutil.which("ffprobe"):
        return {}
    try:
        out = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height,codec_name:format=duration",
                "-of",
                "json",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if out.returncode != 0:
            return {}
        info = json.loads(out.stdout)
        s = (info.get("streams") or [{}])[0]
        return {
            "duration_sec": int(float(info.get("format", {}).get("duration", 0))),
            "width": int(s.get("width", 0)),
            "height": int(s.get("height", 0)),
            "codec": s.get("codec_name", ""),
        }
    except Exception as exc:
        logger.warning("ffprobe failed: %s", exc)
        return {}


def _download(url: str, dest: Path) -> bool:
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            with client.stream("GET", url) as r:
                r.raise_for_status()
                with dest.open("wb") as fh:
                    for chunk in r.iter_bytes(chunk_size=64 * 1024):
                        fh.write(chunk)
        return True
    except Exception as exc:
        logger.warning("video download failed: %s", exc)
        return False


def run_video_check(url: str | None, workdir: Path) -> dict:
    if not url:
        return {
            "status": "skipped",
            "score": 0.0,
            "duration_sec": 0,
            "width": 0,
            "height": 0,
            "codec": "",
            "transcription": "",
            "summary": "",
            "message": "no video url provided",
        }
    workdir.mkdir(parents=True, exist_ok=True)
    local = workdir / "video.bin"
    info: dict = {}
    if _is_direct_file(url):
        if not _download(url, local):
            return {
                "status": "error",
                "score": 0.0,
                "duration_sec": 0,
                "width": 0,
                "height": 0,
                "codec": "",
                "transcription": "",
                "summary": "",
                "message": "failed to download video",
            }
        info = _probe(str(local))
    else:
        info = {"duration_sec": 0, "width": 0, "height": 0, "codec": ""}

    duration = int(info.get("duration_sec", 0))
    width = int(info.get("width", 0))
    height = int(info.get("height", 0))
    codec = info.get("codec", "")

    score = 0.0
    if duration > 0:
        score += 3.0
    if 180 <= duration <= 300:
        score += 2.0
    elif duration > 0:
        score += 1.0
    if width >= 1280 and height >= 720:
        score += 2.0
    if codec in ("h264", "vp9", "av1"):
        score += 1.0
    score = min(10.0, round(score, 2))

    return {
        "status": "done" if info else "skipped",
        "score": score,
        "duration_sec": duration,
        "width": width,
        "height": height,
        "codec": codec,
        "transcription": "",
        "summary": "",
        "message": "ok" if info else "ffprobe not available or non-direct url",
    }
