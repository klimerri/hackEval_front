"""Video (screencast) check service.

Accepts a local uploaded video file path OR a URL (direct video file or a link
to a video hosting such as YouTube). It:

- verifies the screencast is actually present and readable;
- extracts basic technical parameters with ``ffprobe`` (duration, resolution,
  codec);
- extracts the audio track with ``ffmpeg`` and runs automatic speech
  transcription (faster-whisper, if available);
- generates a short text summary of the transcript for reviewers.

Transcription is best-effort: when the speech-to-text engine is unavailable the
check still completes with the technical parameters and an empty transcript.
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_CHARS = 8000
MAX_SUMMARY_CHARS = 600
VIDEO_EXTS = (".mp4", ".mov", ".webm", ".mkv", ".avi")


def _is_direct_file(url: str) -> bool:
    return urlparse(url).path.lower().endswith(VIDEO_EXTS)


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


def _extract_audio(video_path: str, out_wav: Path) -> bool:
    """Extract a mono 16 kHz WAV audio track (the format ASR models expect)."""
    if not shutil.which("ffmpeg"):
        return False
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                video_path,
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "wav",
                str(out_wav),
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        return proc.returncode == 0 and out_wav.exists() and out_wav.stat().st_size > 0
    except Exception as exc:
        logger.warning("audio extraction failed: %s", exc)
        return False


def _transcribe(wav_path: Path) -> str:
    """Transcribe speech with faster-whisper if installed; else return "".

    The model is configurable via WHISPER_MODEL (default "tiny" for speed) and
    is downloaded automatically on first use.
    """
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception:
        logger.info("faster-whisper not installed; skipping transcription")
        return ""
    try:
        model_name = os.environ.get("WHISPER_MODEL", "tiny")
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segments, _info = model.transcribe(str(wav_path), vad_filter=True)
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text[:MAX_TRANSCRIPT_CHARS]
    except Exception as exc:
        logger.warning("transcription failed: %s", exc)
        return ""


def _summarize(text: str) -> str:
    """Lightweight extractive summary: pick the most representative sentences.

    No external LLM is required — sentences are ranked by the frequency of the
    (non-trivial) words they contain, then the top ones are returned in their
    original order. Good enough to give reviewers a quick gist.
    """
    text = (text or "").strip()
    if not text:
        return ""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if len(sentences) <= 2:
        return text[:MAX_SUMMARY_CHARS]
    words = re.findall(r"\w+", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if len(w) > 3:
            freq[w] = freq.get(w, 0) + 1
    scored = []
    for idx, sent in enumerate(sentences):
        sw = re.findall(r"\w+", sent.lower())
        score = sum(freq.get(w, 0) for w in sw) / (len(sw) or 1)
        scored.append((score, idx, sent))
    top = sorted(scored, reverse=True)[:3]
    chosen = [s for _, _, s in sorted(top, key=lambda t: t[1])]
    summary = " ".join(chosen)
    return summary[:MAX_SUMMARY_CHARS]


def _fmt_duration(sec: int) -> str:
    if sec <= 0:
        return "неизвестна"
    return f"{sec // 60} мин {sec % 60} c" if sec >= 60 else f"{sec} c"


def _tech_summary(duration: int, width: int, height: int, codec: str) -> str:
    """Fallback description for a screencast without recognised speech, so
    reviewers still get a brief text note about it."""
    res = f"{width}×{height}" if width and height else "разрешение неизвестно"
    return (
        "Скринкаст без распознанной озвучки. "
        f"Длительность: {_fmt_duration(duration)}; "
        f"{res}; кодек: {codec or 'неизвестен'}."
    )


def _empty(status: str, message: str) -> dict:
    return {
        "status": status,
        "score": 0.0,
        "duration_sec": 0,
        "width": 0,
        "height": 0,
        "codec": "",
        "transcription": "",
        "summary": "",
        "message": message,
    }


def run_video_check(source: str | None, workdir: Path) -> dict:
    if not source:
        return _empty("skipped", "no video file or url provided")
    workdir.mkdir(parents=True, exist_ok=True)

    # Resolve a local media file: uploaded file path, or a downloaded direct URL.
    local: Path | None = None
    if os.path.exists(source):
        local = Path(source)
    elif _is_direct_file(source):
        dest = workdir / "video.bin"
        if not _download(source, dest):
            return _empty("error", "failed to download video")
        local = dest
    # else: a hosting link (YouTube etc.) we cannot probe/transcribe directly.

    info = _probe(str(local)) if local else {}
    duration = int(info.get("duration_sec", 0))
    width = int(info.get("width", 0))
    height = int(info.get("height", 0))
    codec = info.get("codec", "")

    # Audio extraction + transcription + summary (only for a real media file).
    transcription = ""
    summary = ""
    if local and local.exists():
        wav = workdir / "audio.wav"
        if _extract_audio(str(local), wav):
            transcription = _transcribe(wav)
            summary = _summarize(transcription)
            try:
                wav.unlink()
            except Exception:
                pass
        # No speech recognised (silent screencast or ASR unavailable): still
        # produce a brief technical description so reviewers get a summary.
        if not summary:
            summary = _tech_summary(duration, width, height, codec)

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
    if transcription:
        score += 1.0  # screencast has an audible narration track
    score = min(10.0, round(score, 2))

    if not local:
        return {
            **_empty("done", "ссылка на видеохостинг — техпараметры недоступны"),
            "score": 1.0,
        }

    bits = [f"{duration}s", f"{width}x{height}", codec or "codec?"]
    if transcription:
        bits.append("транскрипция готова")
    return {
        "status": "done" if info else "error",
        "score": score,
        "duration_sec": duration,
        "width": width,
        "height": height,
        "codec": codec,
        "transcription": transcription,
        "summary": summary,
        "message": " · ".join(bits) if info else "не удалось прочитать видео",
    }
