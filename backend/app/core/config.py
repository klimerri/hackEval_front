from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "HackAuth"
    app_env: str = "dev"
    secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_user: str = "hackauth"
    postgres_password: str = "hackauth"
    postgres_db: str = "hackauth"

    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0

    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    upload_dir: str = "/app/uploads"
    max_upload_mb: int = 64

    judge_time_limit_sec: int = 2
    judge_memory_limit_mb: int = 128

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
