# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_EXTRA_INDEX_URL=https://pypi.org/simple

# System deps. apt caches live on a BuildKit cache mount so packages are not
# re-downloaded on rebuilds (we therefore do NOT delete /var/lib/apt/lists).
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpq-dev \
    nodejs \
    npm

# Mirror + retry config for pip. The TUNA mirror is the primary source; pypi.org
# stays as a fallback. Longer timeout + extra retries survive flaky networks
# during `docker build` (default 15s read-timeout is too aggressive for slow
# mirrors / cold caches).
RUN mkdir -p /etc && \
    printf '%s\n' \
        '[global]' \
        'index-url = https://pypi.tuna.tsinghua.edu.cn/simple' \
        'extra-index-url = https://pypi.org/simple' \
        'timeout = 120' \
        'retries = 10' \
        > /etc/pip.conf

WORKDIR /app

# Python deps. The pip download cache persists across builds via a cache mount,
# so even when requirements.txt changes the wheels are reused (no re-download).
# torch is pulled from the official CPU index directly (mirrors don't always
# carry the right CUDA/CPU build).
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt

# Self-contained ESLint toolchain (lint submitted JS/TS). The npm cache also
# persists across builds.
COPY lint/package*.json /app/lint/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/lint && npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p /app/uploads

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
