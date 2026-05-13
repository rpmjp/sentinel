"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All app config in one place. Override via env vars or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="postgresql+psycopg://sentinel:devpassword@localhost:5433/sentinel_dev",
        description="SQLAlchemy connection string for Postgres",
    )

    # Auth
    jwt_secret: str = Field(
        default="dev-secret-change-in-prod-must-be-at-least-32-bytes-long",
        description="HMAC secret for JWT signing (override via JWT_SECRET env var in prod)",
    )
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # Model serving
    model_path: str = Field(
        default="models/lightgbm.joblib",
        description="Path to the joblib model artifact",
    )

    # Misc
    env: str = Field(default="development")
    log_level: str = Field(default="INFO")


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()