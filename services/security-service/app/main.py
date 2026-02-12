"""
SRE Copilot Security Service
"""
import logging
from fastapi import FastAPI

from app.api import vulnerabilities
from app.services.demo_data import generate_demo_vulnerabilities

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Security Service",
    description="Vulnerability management and security scanning",
    version="1.0.0",
)

app.include_router(vulnerabilities.router, prefix="/vulnerabilities")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "security-service"}


def _seed_demo_data() -> None:
    """Seed demo vulnerabilities on startup."""
    from app.api.vulnerabilities import VULNERABILITIES

    if VULNERABILITIES:
        return

    for v in generate_demo_vulnerabilities():
        VULNERABILITIES[v["vuln_id"]] = v
    logger.info("Seeded %d demo vulnerabilities", len(VULNERABILITIES))


@app.on_event("startup")
async def startup_event():
    """Startup - seed demo data."""
    logger.info("Security Service starting up...")
    _seed_demo_data()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event."""
    logger.info("Security Service shutting down...")
