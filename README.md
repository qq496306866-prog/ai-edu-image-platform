# AI Edu Image Platform

AI 教辅批量生图平台第一版项目骨架。

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- Queue: Redis, Celery
- Deployment: Docker Compose

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── db/
│   │   ├── main.py
│   │   └── worker.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```

## Quick Start

Copy the sample environment file if you want to customize values:

```bash
cp .env.example .env
```

Start all services:

```bash
docker compose up --build
```

Visit:

- Frontend: http://localhost:3000
- Backend health check: http://localhost:8000/health

## Services

- `frontend`: Next.js app exposed on port `3000`
- `backend`: FastAPI app exposed on port `8000`
- `postgres`: PostgreSQL database
- `redis`: Redis broker/cache
- `worker`: Celery worker connected to Redis and the backend code

## Basic Checks

After startup, verify the backend can reach PostgreSQL and Redis:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```
