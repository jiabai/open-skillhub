# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS python-base

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

RUN addgroup --system skillhub \
    && adduser --system --ingroup skillhub --home /app skillhub

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder --chown=skillhub:skillhub /app/backend /app/backend

RUN mkdir -p /app/data /tmp/uv-cache /tmp/.cache \
    && chown -R skillhub:skillhub /app/data /tmp/uv-cache /tmp/.cache

USER skillhub

EXPOSE 8001

CMD ["/app/.venv/bin/uvicorn", "backend.api_app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
