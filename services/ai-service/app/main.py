"""
AI Service - Hypothesis generation and AI operations
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

from app.api import ai, analytics
from app.services.redis_publisher import redis_publisher

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot AI Service",
    description="AI and Hypothesis Generation Service",
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
app.include_router(ai.router, tags=["AI"])
app.include_router(analytics.router, tags=["Analytics"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    print("🤖 AI Service starting up...")
    await redis_publisher.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    print("👋 AI Service shutting down...")
    await redis_publisher.disconnect()
