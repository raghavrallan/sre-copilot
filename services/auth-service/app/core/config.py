"""
Configuration settings for Auth Service
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = "development"  # production, development, staging

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database
    DATABASE_URL: str = "postgresql://sre_user:sre_password@postgres:5432/sre_copilot"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
