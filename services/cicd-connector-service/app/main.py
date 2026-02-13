"""
CI/CD Connector Service - Manage CI/CD pipeline connections (GitHub, Azure DevOps, etc.)
"""
import logging
import os
import sys

from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Initialize Django
from shared.utils.database import setup_django
setup_django()

from app.api import connections, webhooks

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot CI/CD Connector Service",
    description="Manage CI/CD pipeline connections (GitHub, Azure DevOps) and webhooks",
    version="1.0.0",
)

# Include routers
app.include_router(connections.router, prefix="/connections", tags=["Connections"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "cicd-connector-service"}
