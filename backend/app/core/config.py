from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/ai_edu_image_platform"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    backend_cors_origins: str = "http://localhost:3000"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 1440
    upload_dir: str = "storage/uploads"
    generated_dir: str = "storage/generated"
    max_upload_size_mb: int = 20
    image_provider: str = "mock"
    image_api_base_url: str = ""
    image_api_key: str = ""
    image_model: str = ""
    image_api_timeout_seconds: float = 60.0
    image_api_retry_count: int = 2
    mock_image_delay_seconds: float = 0.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
