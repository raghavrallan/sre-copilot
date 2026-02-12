"""
Integration Service - External integrations (Prometheus, PagerDuty, etc.)
"""
from fastapi import FastAPI
import os
import sys

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Initialize Django for database access
from shared.utils.database import setup_django
setup_django()

from app.api import webhooks

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Integration Service",
    description="External Integrations Service",
    version="1.0.0"
)

# Include routers
app.include_router(webhooks.router, tags=["Webhooks"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "integration-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    print("🔌 Integration Service starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    print("👋 Integration Service shutting down...")
