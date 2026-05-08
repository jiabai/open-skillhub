# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS python-base

WORKDIR /app

ARG UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    UV_DEFAULT_INDEX=${UV_DEFAULT_INDEX} \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

FROM python-base AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.3 /uv /uvx /bin/

COPY pyproject.toml uv.lock LICENSE README.md README-zh.md /app/
COPY backend/__init__.py /app/backend/__init__.py

RUN --mount=type=cache,target=/tmp/uv-cache,sharing=locked \
    uv sync --frozen --no-dev --no-install-project

COPY backend /app/backend

RUN --mount=type=cache,target=/tmp/uv-cache,sharing=locked \
    uv sync --frozen --no-dev

FROM python-base AS runtime

RUN addgroup --system skilldrive \
    && adduser --system --ingroup skilldrive --home /app skilldrive

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder --chown=skilldrive:skilldrive /app/backend /app/backend

RUN rm -f /app/.venv/bin/python && \
    ln -s /usr/local/bin/python3.14 /app/.venv/bin/python && \
    rm -f /app/.venv/bin/python3 && \
    ln -s /usr/local/bin/python3.14 /app/.venv/bin/python3 && \
    rm -f /app/.venv/bin/python3.14 && \
    ln -s /usr/local/bin/python3.14 /app/.venv/bin/python3.14

RUN mkdir -p /app/data /tmp/uv-cache /tmp/.cache \
    && chown -R skilldrive:skilldrive /app/data /tmp/uv-cache /tmp/.cache

USER skilldrive

EXPOSE 8001

CMD ["/app/.venv/bin/uvicorn", "backend.api_app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
