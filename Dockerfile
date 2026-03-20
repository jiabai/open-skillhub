FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml LICENSE README.md README_ZH.md alembic.ini /app/
COPY skillhub /app/skillhub

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000"]
