"""
CSAgent Backend — Core Configuration
Reads all settings from .env via pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "CSAgent"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Database
    database_url: str = "sqlite+aiosqlite:///./csagent.db"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Gemini API (Phase 2+)
    gemini_api_key: str = ""

    # Initial Admin
    first_superuser: str = "admin@csagent.ai"
    first_superuser_password: str = "Admin@1234!"

    # LangGraph (Phase 2 — no LangSmith)
    redis_url: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
