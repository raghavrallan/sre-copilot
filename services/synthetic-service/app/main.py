"""
SRE Copilot Synthetic Monitoring Service
"""
import logging
import os
import sys

# Add shared to path and initialize Django BEFORE importing app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
from shared.utils.database import setup_django
setup_django()

from fastapi import FastAPI

from shared.utils.responses import install_validation_handler
from app.api import monitors

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Synthetic Monitoring Service",
    description="Synthetic monitoring with ping and API tests",
    version="1.0.0",
)

app.include_router(monitors.router, prefix="/monitors")

# Install centralized 422->400 validation error handler
install_validation_handler(app)

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "synthetic-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event."""
    logger.info("Synthetic Monitoring Service starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event."""
    logger.info("Synthetic Monitoring Service shutting down...")
