import os
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Accept connection strings as hosting providers give them (Neon, Render, Supabase).

    - postgres:// or postgresql:// becomes postgresql+asyncpg://
    - libpq-only options (sslmode, channel_binding) that asyncpg rejects are translated or removed
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    if not url.startswith("postgresql+asyncpg://"):
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode in ("require", "verify-ca", "verify-full") and "ssl" not in query:
        query["ssl"] = "require"
    return urlunsplit(parts._replace(query=urlencode(query)))

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://foodrescue_user:foodrescue_password@localhost:5432/foodrescue"
    SYNC_DATABASE_URL: str = "postgresql://foodrescue_user:foodrescue_password@localhost:5432/foodrescue"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "demo_secret_key_must_be_changed_in_production_extremely_long_string_here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440
    ENVIRONMENT: str = "development"
    OPENAI_API_KEY: Optional[str] = "mock_openai_api_key_for_dev"
    DEFAULT_JURISDICTION: str = "ANDHRA_PRADESH"
    DEFAULT_LANGUAGE: str = "en"

    # Sessions: a normal sign-in lasts SESSION_EXPIRE_MINUTES; "Remember me" extends it.
    SESSION_EXPIRE_MINUTES: int = 480
    REMEMBER_ME_EXPIRE_DAYS: int = 7

    # Public URL of the web app, used in verification and password-reset links.
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Outgoing email. When SMTP_HOST is empty, emails are written to the server log instead.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "FoodRescue <no-reply@foodrescue.org>"

    # SMS provider for phone verification. Phone verification is disabled until one is configured.
    SMS_PROVIDER: Optional[str] = None

    # Verification document uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 5

    # Rate limits (per client IP + identifier)
    LOGIN_MAX_FAILURES: int = 5
    LOGIN_WINDOW_SECONDS: int = 900

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        return normalize_database_url(v.strip())

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()