# syntax=docker/dockerfile:1
#
# WomSakhi API — FastAPI on Cloud Run.
#
# Python 3.11 to match the virtualenv this is developed against; the pinned
# requirements include wheels that are built per minor version, so 3.12 is not
# a free upgrade.

FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first and on their own layer, so a code change does not reinstall
# 38 packages on every build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Not root.
RUN useradd --create-home --uid 1001 womsakhi \
    && mkdir -p /app/media /app/private_media /app/outbox \
    && chown -R womsakhi:womsakhi /app
USER womsakhi

# Cloud Run injects PORT. Bind to it, not to the 8020 used in development —
# main.py's `__main__` block hardcodes 8020 with reload on, which is a
# development entrypoint and is deliberately not what runs here.
ENV PORT=8080
EXPOSE 8080

# One worker per container, and let Cloud Run scale containers instead. The
# app holds a Motor client whose pool is sized per process, so N workers means
# N pools against the same Atlas cluster and N times the connection count —
# the fastest way to hit an Atlas connection limit is to "tune" this upward.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'
