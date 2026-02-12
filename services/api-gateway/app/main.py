"""
API Gateway - Main entry point for all requests
"""
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import os
import sys

logger = logging.getLogger(__name__)

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from app.api import health, proxy
from app.core.config import settings
from app.middleware.encryption_middleware import EncryptionMiddleware, RateLimitMiddleware

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot API Gateway",
    description="Main API Gateway for SRE Copilot microservices",
    version="1.0.0"
)

# Add rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=100
)

# Add encryption middleware (disabled by default, opt-in via X-Encryption-Enabled header)
app.add_middleware(
    EncryptionMiddleware,
    enabled=False,
    exclude_paths=["/health", "/docs", "/openapi.json", "/redoc", "/"]
)

# CORS middleware - allow specific origins with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://frontend:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-Encryption-Enabled",
        "X-Encryption-Key-ID"
    ]
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(proxy.router, prefix="/api/v1", tags=["API"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler - never leak internal details to clients"""
    import logging
    logger = logging.getLogger("api_gateway")
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)

    # Only include error details in development mode
    if settings.ENVIRONMENT == "development":
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "type": type(exc).__name__
            }
        )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error"
        }
    )


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("API Gateway starting up")
    logger.info("Environment: %s", settings.ENVIRONMENT)
    logger.info("Auth Service: %s", settings.AUTH_SERVICE_URL)
    logger.info("Incident Service: %s", settings.INCIDENT_SERVICE_URL)


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("API Gateway shutting down")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "SRE Copilot API Gateway",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }
