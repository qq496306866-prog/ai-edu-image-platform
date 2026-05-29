from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine

settings = get_settings()

app = FastAPI(title="AI Edu Image Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=status.HTTP_200_OK)
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    redis_client = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
    redis_client.ping()

    return {
        "status": "ok",
        "database": "ok",
        "redis": "ok",
    }
