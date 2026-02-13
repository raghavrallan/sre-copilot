"""
SRE Copilot Synthetic Monitoring Service
"""
import logging
from fastapi import FastAPI

from app.api import monitors
from app.services.demo_data import generate_demo_monitors, generate_demo_results

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Synthetic Monitoring Service",
    description="Synthetic monitoring with ping and API tests",
    version="1.0.0",
)

app.include_router(monitors.router, prefix="/monitors")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "synthetic-service"}


def _seed_demo_data() -> None:
    """Seed demo monitors and 50+ results per monitor on startup."""
    from app.api.monitors import MONITORS, RESULTS

    if MONITORS:
        return

    for m in generate_demo_monitors():
        import uuid

        monitor_id = str(uuid.uuid4())
        monitor = {
            "monitor_id": monitor_id,
            "name": m["name"],
            "type": m["type"],
            "url": m["url"],
            "frequency_seconds": m["frequency_seconds"],
            "assertions": m["assertions"],
            "headers": m.get("headers", {}),
            "method": m.get("method", "GET"),
            "body": m.get("body"),
            "enabled": m.get("enabled", True),
        }
        MONITORS[monitor_id] = monitor
        RESULTS[monitor_id] = generate_demo_results(monitor_id, count=55)
        logger.info("Seeded monitor %s with %d results", m["name"], len(RESULTS[monitor_id]))


@app.on_event("startup")
async def startup_event():
    """Startup - seed demo data."""
    logger.info("Synthetic Monitoring Service starting up...")
    _seed_demo_data()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event."""
    logger.info("Synthetic Monitoring Service shutting down...")
