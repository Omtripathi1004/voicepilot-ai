# Multi-stage Dockerfile for VoicePilot AI
# Builds React frontend and serves FastAPI backend

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Unified Serve
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# Copy built frontend assets
COPY --from=frontend-builder /frontend/dist ./frontend_dist

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend
ENV PORT=8000

EXPOSE 8000

# Run backend application
CMD ["uvicorn", "backend.app.api.routes:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
