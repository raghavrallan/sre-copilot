"""
Configuration settings for API Gateway
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = "development"

    # CORS - includes Cloudflare Pages production domain
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8500",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8500",
        "http://frontend:3000",
        "https://sre-copilot.pages.dev",
    ]

    # Production frontend URL (set via env var FRONTEND_URL on Render)
    FRONTEND_URL: str = ""

    # Database (uses environment variable from docker-compose)
    DATABASE_URL: str = "postgresql://srecopilot:password@localhost:5432/srecopilot"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Microservices URLs
    AUTH_SERVICE_URL: str = "http://auth-service:8501"
    INCIDENT_SERVICE_URL: str = "http://incident-service:8502"
    AI_SERVICE_URL: str = "http://ai-service:8503"
    INTEGRATION_SERVICE_URL: str = "http://integration-service:8504"

    # Timeouts
    SERVICE_TIMEOUT: int = 30

    # Internal service auth (shared secret for gateway-to-backend requests)
    INTERNAL_SERVICE_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
