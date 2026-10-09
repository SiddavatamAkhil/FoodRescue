import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
