# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Install deps first (layer cache)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy app
COPY . .

EXPOSE 8080

# Run via gunicorn — 2 workers is plenty for a marketing site on shared CPU
CMD ["gunicorn", "-w", "2", "-k", "gthread", "--threads", "4", \
     "-b", "0.0.0.0:8080", "--access-logfile", "-", "--error-logfile", "-", \
     "app:app"]
