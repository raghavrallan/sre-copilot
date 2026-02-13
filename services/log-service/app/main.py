"""
SRE Copilot Log Service - Log management microservice.
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
from app.api.logs import router as logs_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Log Service",
    description="Log management microservice for ingestion, search, patterns, and live tail",
    version="1.0.0",
)

# Include routers
app.include_router(logs_router)

# Install centralized 422->400 validation error handler
install_validation_handler(app)

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "log-service"}


@app.on_event("startup")
async def startup_event() -> None:
    """Startup event."""
    logger.info("Starting SRE Copilot Log Service...")
