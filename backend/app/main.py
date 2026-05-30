from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from sqlalchemy import text

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app import models  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.uploads import router as uploads_router

settings = get_settings()

app = FastAPI(title="AI Edu Image Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(uploads_router)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


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
