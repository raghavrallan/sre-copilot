"""SRE Copilot Alerting Service - Advanced alerting for APM metrics."""
import logging

from fastapi import FastAPI

from app.api import alert_conditions, alert_policies, notification_channels, muting_rules, active_alerts
from app.services.demo_data import seed_demo_data

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


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "alerting-service"}


@app.on_event("startup")
async def startup_event() -> None:
    """Startup event - seed demo data if storage is empty."""
    logger.info("SRE Copilot Alerting Service starting up...")
    seed_demo_data()
