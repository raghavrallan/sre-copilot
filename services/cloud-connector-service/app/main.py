"""
Cloud Connector Service - Manage cloud provider connections
"""
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
import os
import sys

logger = logging.getLogger(__name__)

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Initialize Django
from shared.utils.database import setup_django
setup_django()

from app.api import connections
from app.services.sync_worker import run_sync_loop

# Background task handle
_sync_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global _sync_task
    logger.info("Cloud Connector Service starting up")
    _sync_task = asyncio.create_task(run_sync_loop())
    yield
    logger.info("Cloud Connector Service shutting down")
    if _sync_task:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass


# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Cloud Connector Service",
    description="Manage cloud provider connections (Azure, AWS, GCP)",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(connections.router, prefix="/connections", tags=["Connections"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "cloud-connector-service"}
