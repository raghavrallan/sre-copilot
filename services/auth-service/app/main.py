"""
Auth Service - Authentication and Authorization
"""
import logging
from fastapi import FastAPI
import os
import sys

logger = logging.getLogger(__name__)

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Initialize Django
from shared.utils.database import setup_django
setup_django()

from app.api import auth, projects, monitoring, api_keys, internal
from app.core.config import settings

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Auth Service",
    description="Authentication and Authorization Service",
    version="1.0.0"
)

# Include routers
app.include_router(auth.router, tags=["Auth"])
app.include_router(projects.router, tags=["Projects"])
app.include_router(monitoring.router, tags=["Monitoring"])
app.include_router(api_keys.router, tags=["API Keys"])
app.include_router(internal.router, tags=["Internal"])

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auth-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("Auth Service starting up")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("Auth Service shutting down")
