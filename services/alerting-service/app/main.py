"""SRE Copilot Alerting Service - Advanced alerting for APM metrics."""
import asyncio
import logging
import os
import sys

# Add workspace root to path (contains shared/)
for rel in ('../..', '../../..'):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), rel))
    if os.path.exists(os.path.join(root, 'shared')):
        sys.path.insert(0, root)
        break

# Initialize Django before importing app modules
from shared.utils.database import setup_django
setup_django()

from fastapi import FastAPI

from app.api import alert_conditions, alert_policies, notification_channels, muting_rules, active_alerts
from app.services.evaluator import evaluate_all_conditions

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Alerting Service",
    description="Advanced alerting for APM metrics - conditions, policies, channels, muting",
    version="1.0.0",
)

# Include routers
app.include_router(alert_conditions.router)
app.include_router(alert_policies.router)
app.include_router(notification_channels.router)
app.include_router(muting_rules.router)
app.include_router(active_alerts.router)

# Prometheus instrumentation for platform health monitoring
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:
    pass  # prometheus not installed, skip


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "alerting-service"}


async def alert_evaluation_loop():
    """Background loop that evaluates alert conditions every 60 seconds."""
    while True:
        try:
            await evaluate_all_conditions()
        except Exception as e:
            logger.error("Alert evaluation error: %s", e)
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup_event() -> None:
    """Startup event."""
    logger.info("SRE Copilot Alerting Service starting up...")
    asyncio.create_task(alert_evaluation_loop())
