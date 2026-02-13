"""SRE Copilot FastAPI middleware - Auto-instruments every request.

When using the public API gateway, pass an api_key to SRECopilotClient for authentication.
The middleware uses the client, so API key auth is applied automatically when configured.
"""
import logging
import time
from typing import List, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class SRECopilotMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that auto-instruments every request and records APM metrics."""

    def __init__(
        self,
        app,
        client=None,
        service_name: str = "unknown",
        exclude_paths: Optional[List[str]] = None,
    ) -> None:
        super().__init__(app)
        self.client = client
        self.service_name = service_name
        self.exclude_paths = exclude_paths or [
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc",
        ]

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request and record transaction metrics."""
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        start_time = time.perf_counter()
        error_msg: Optional[str] = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as e:
            error_msg = str(e)
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            if self.client:
                self.client.record_transaction(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    error=error_msg,
                )
