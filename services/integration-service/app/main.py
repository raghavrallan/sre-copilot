"""
Integration Service - External integrations (Prometheus, PagerDuty, etc.)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import webhooks

# Initialize FastAPI app
app = FastAPI(
    title="SRE Copilot Integration Service",
    description="External Integrations Service",
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
