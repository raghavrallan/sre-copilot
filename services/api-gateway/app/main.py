"""
API Gateway - Main entry point for all requests
"""
import logging
import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

logger = logging.getLogger(__name__)

# Add shared to path and initialize Django BEFORE importing app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from shared.utils.database import setup_django

setup_django()

from app.api import health, proxy, observability_proxy, ingest_proxy, settings_api
from app.core.config import settings
from app.middleware.encryption_middleware import EncryptionMiddleware, RateLimitMiddleware
from shared.utils.responses import install_validation_handler

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

# Build CORS origins list - include production frontend URL if set
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://frontend:3000",
    "https://sre-copilot.pages.dev",
]
# Add custom FRONTEND_URL from env (e.g. custom Cloudflare Pages domain)
if settings.FRONTEND_URL:
    cors_origins.append(settings.FRONTEND_URL)

# CORS middleware - allow specific origins with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(observability_proxy.router, prefix="/api/v1", tags=["Observability"])
app.include_router(ingest_proxy.router, prefix="/api/v1", tags=["Ingest"])
app.include_router(settings_api.router, prefix="/api/v1", tags=["Settings"])

# Install centralized 422->400 validation error handler
install_validation_handler(app)

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


# ---- Specific exception handlers for httpx errors (proxy failures) ----

@app.exception_handler(httpx.ConnectError)
async def httpx_connect_error_handler(request: Request, exc: httpx.ConnectError):
    """When a backend service is unreachable, return 502 Bad Gateway."""
    logger.warning("Service unreachable for %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={
            "detail": "Backend service is unreachable. Please try again later.",
            "error": "service_unavailable",
        }
    )


@app.exception_handler(httpx.ConnectTimeout)
async def httpx_connect_timeout_handler(request: Request, exc: httpx.ConnectTimeout):
    """When connection to a backend service times out, return 504 Gateway Timeout."""
    logger.warning("Service connection timeout for %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=504,
        content={
            "detail": "Backend service connection timed out. Please try again later.",
            "error": "gateway_timeout",
        }
    )


@app.exception_handler(httpx.ReadTimeout)
async def httpx_read_timeout_handler(request: Request, exc: httpx.ReadTimeout):
    """When reading from a backend service times out, return 504 Gateway Timeout."""
    logger.warning("Service read timeout for %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=504,
        content={
            "detail": "Backend service response timed out. Please try again later.",
            "error": "gateway_timeout",
        }
    )


@app.exception_handler(httpx.TimeoutException)
async def httpx_timeout_handler(request: Request, exc: httpx.TimeoutException):
    """Catch-all for any httpx timeout, return 504."""
    logger.warning("Service timeout for %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=504,
        content={
            "detail": "Backend service timed out. Please try again later.",
            "error": "gateway_timeout",
        }
    )


@app.exception_handler(httpx.HTTPStatusError)
async def httpx_status_error_handler(request: Request, exc: httpx.HTTPStatusError):
    """Forward HTTP status errors from backend services."""
    logger.warning("Backend HTTP error for %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=exc.response.status_code,
        content={
            "detail": exc.response.text[:500] if exc.response.text else "Backend service error",
            "error": "backend_error",
        }
    )


# ---- Generic exception handler ----

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler - never leak internal details to clients"""
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
