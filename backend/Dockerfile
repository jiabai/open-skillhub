# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

WORKDIR /app

ARG UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV UV_DEFAULT_INDEX=$UV_DEFAULT_INDEX
ENV UV_LINK_MODE=copy
ENV PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.11.3 /uv /uvx /bin/

COPY pyproject.toml uv.lock LICENSE README.md README_ZH.md /app/
COPY backend/__init__.py /app/backend/__init__.py

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY backend /app/backend

EXPOSE 8001

CMD ["sh", "-c", "uv run alembic -c backend/alembic.ini upgrade head && uv run uvicorn backend.api_app:app --host 0.0.0.0 --port 8001"]
