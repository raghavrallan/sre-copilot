"""
Incident Service - Core incident management
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

# Initialize Django
from shared.utils.database import setup_django
setup_django()

from app.api import incidents, workflow
from app.services.redis_publisher import redis_publisher

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Incident Service",
    description="Incident Management Service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(incidents.router, tags=["Incidents"])
app.include_router(workflow.router, tags=["Workflow"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "incident-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    print("🚨 Incident Service starting up...")
    await redis_publisher.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    print("👋 Incident Service shutting down...")
    await redis_publisher.disconnect()
