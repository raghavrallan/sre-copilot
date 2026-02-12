"""
Configuration settings for Auth Service
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = "development"  # production, development, staging

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database (uses environment variable from docker-compose)
    DATABASE_URL: str = "postgresql://srecopilot:password@localhost:5432/srecopilot"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Validate critical secrets at startup
_PLACEHOLDER_SECRETS = {"your-secret-key-change-in-production", "change-this-master-key-in-production", ""}

def validate_secrets():
    """Validate that critical secrets are properly configured"""
    import logging
    logger = logging.getLogger(__name__)

    if settings.JWT_SECRET_KEY in _PLACEHOLDER_SECRETS:
        if settings.ENVIRONMENT == "production":
            raise ValueError("JWT_SECRET_KEY must be set to a secure value in production")
        else:
            logger.warning("WARNING: JWT_SECRET_KEY is using a placeholder value. Set a secure value for production.")

validate_secrets()
