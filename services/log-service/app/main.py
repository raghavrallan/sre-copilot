"""
SRE Copilot Log Service - Log management microservice.
"""
import logging
import sys

from fastapi import FastAPI

from app.api.logs import router as logs_router, set_log_store
from app.services.demo_data import _generate_demo_logs

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


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "log-service"}


@app.on_event("startup")
async def startup_event() -> None:
    """Startup event: load demo logs."""
    logger.info("Starting SRE Copilot Log Service...")
    logs = _generate_demo_logs()
    store = [log.model_dump() for log in logs]
    set_log_store(store)
    logger.info("Loaded %d demo log entries", len(store))
