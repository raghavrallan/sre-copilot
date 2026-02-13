"""
SRE Copilot Security Service
"""
import logging
import os
import sys

# Add shared to path and initialize Django BEFORE importing app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
from shared.utils.database import setup_django
setup_django()

from fastapi import FastAPI

from app.api import vulnerabilities

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Security Service",
    description="Vulnerability management and security scanning",
    version="1.0.0",
)

app.include_router(vulnerabilities.router, prefix="/vulnerabilities")

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "security-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event."""
    logger.info("Security Service starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event."""
    logger.info("Security Service shutting down...")
