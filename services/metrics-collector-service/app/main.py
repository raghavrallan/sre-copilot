"""
SRE Copilot Metrics Collector - APM metrics, traces, and error events
"""
import logging
import os
import sys

from fastapi import FastAPI

# Add shared to path and initialize Django BEFORE importing app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from shared.utils.database import setup_django

setup_django()

from shared.utils.responses import install_validation_handler
from app.api import metrics as metrics_api
from app.api import traces as traces_api
from app.api import errors as errors_api
from app.api import services_registry as services_registry_api
from app.api import infrastructure as infra_api
from app.api import deployments as deploy_api
from app.api import slos as slos_api
from app.api import synthetics as synth_api
from app.api import browser as browser_api
from app.api import dashboards as dashboards_api

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Metrics Collector",
    description="APM metrics, traces, and error events collection service",
    version="1.0.0",
)

# Include routers
app.include_router(metrics_api.router, prefix="/metrics", tags=["Metrics"])
app.include_router(services_registry_api.router, prefix="/services", tags=["Services"])
app.include_router(traces_api.router, prefix="/traces", tags=["Traces"])
app.include_router(errors_api.router, prefix="/errors", tags=["Errors"])
app.include_router(infra_api.router, prefix="/infrastructure", tags=["Infrastructure"])
app.include_router(deploy_api.router, prefix="/deployments", tags=["Deployments"])
app.include_router(slos_api.router, prefix="/slos", tags=["SLOs"])
app.include_router(synth_api.router, prefix="/synthetics", tags=["Synthetics"])
app.include_router(browser_api.router, prefix="/browser", tags=["Browser"])
app.include_router(dashboards_api.router, prefix="/dashboards", tags=["Dashboards"])

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
    """Health check endpoint"""
    return {"status": "healthy", "service": "metrics-collector-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("Metrics Collector Service starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("Metrics Collector Service shutting down...")
