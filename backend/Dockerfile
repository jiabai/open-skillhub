FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml LICENSE README.md README_ZH.md /app/
COPY backend /app/backend

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8001

CMD ["sh", "-c", "alembic -c backend/alembic.ini upgrade head && uvicorn backend.api_app:app --host 0.0.0.0 --port 8001"]
