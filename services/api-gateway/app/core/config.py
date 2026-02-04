"""
Configuration settings for API Gateway
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = "development"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "http://frontend:5173"
    ]

    # Database (uses environment variable from docker-compose)
    DATABASE_URL: str = "postgresql://srecopilot:password@localhost:5432/srecopilot"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Microservices URLs
    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    INCIDENT_SERVICE_URL: str = "http://incident-service:8002"
    AI_SERVICE_URL: str = "http://ai-service:8003"
    INTEGRATION_SERVICE_URL: str = "http://integration-service:8004"

    # Timeouts
    SERVICE_TIMEOUT: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
