"""
Auth Service - Authentication and Authorization
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

from app.api import auth, projects
from app.core.config import settings

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Auth Service",
    description="Authentication and Authorization Service",
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
app.include_router(auth.router, tags=["Auth"])
app.include_router(projects.router, tags=["Projects"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auth-service"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    print("🔐 Auth Service starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    print("👋 Auth Service shutting down...")
