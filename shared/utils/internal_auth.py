"""
Internal service authentication utility.

All inter-service requests from the API Gateway must include the
X-Internal-Service-Key header. Backend services use verify_internal_auth()
as a FastAPI dependency to enforce this.
"""
import os
import logging
from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)

INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")


def verify_internal_auth(
    x_internal_service_key: str = Header(None, alias="X-Internal-Service-Key")
) -> bool:
    """
    FastAPI dependency to verify internal service-to-service authentication.

    The API Gateway sets X-Internal-Service-Key header when proxying requests.
    Backend services use this to ensure requests come from the gateway.
    """
    if not INTERNAL_SERVICE_KEY:
        logger.warning("INTERNAL_SERVICE_KEY not configured - skipping internal auth check")
        return True

    if not x_internal_service_key or x_internal_service_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing internal service key"
        )
    return True
