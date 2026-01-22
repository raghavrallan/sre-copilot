"""
Encryption Middleware for API Gateway
Automatically encrypts API responses
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import json
from typing import Callable
import time

from app.core.security.encryption import encryption_manager


class EncryptionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to encrypt API responses

    Can be enabled/disabled per-request via headers or config
    """

    def __init__(self, app, enabled: bool = True, exclude_paths: list = None):
        """
        Initialize encryption middleware

        Args:
            app: FastAPI app
            enabled: Whether encryption is enabled globally
            exclude_paths: List of paths to exclude from encryption
        """
        super().__init__(app)
        self.enabled = enabled
        self.exclude_paths = exclude_paths or [
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc"
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and encrypt response if applicable

        Args:
            request: Incoming request
            call_next: Next middleware/handler

        Returns:
            Response (encrypted if applicable)
        """
        # Check if path should be excluded
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # Check if client requested encryption
        # Header: X-Encryption-Enabled: true/false
        encryption_header = request.headers.get("X-Encryption-Enabled", "").lower()

        # Determine if we should encrypt
        should_encrypt = self.enabled

        # Client can opt-out
        if encryption_header == "false":
            should_encrypt = False
        # Client can opt-in even if globally disabled
        elif encryption_header == "true":
            should_encrypt = True

        # Process request
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        # Only encrypt JSON responses with 200 status
        if not should_encrypt:
            response.headers["X-Encryption-Enabled"] = "false"
            return response

        # Check if response is JSON
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        # Check status code (only encrypt successful responses)
        if response.status_code >= 400:
            return response

        # Read response body
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        try:
            # Parse JSON response
            data = json.loads(response_body.decode('utf-8'))

            # Encrypt data
            encrypted_payload = encryption_manager.encrypt_data(data)

            # Add metadata
            encrypted_payload["meta"] = {
                "process_time": f"{process_time:.4f}s",
                "encrypted_at": encrypted_payload["timestamp"]
            }

            # Create encrypted response
            # Don't copy Content-Length header as it will be wrong for encrypted content
            headers_to_copy = {k: v for k, v in response.headers.items()
                             if k.lower() not in ['content-length', 'content-type']}

            encrypted_response = JSONResponse(
                content=encrypted_payload,
                status_code=response.status_code,
                headers=headers_to_copy
            )

            # Add encryption headers
            encrypted_response.headers["X-Encryption-Enabled"] = "true"
            encrypted_response.headers["X-Encryption-Algorithm"] = "AES-256-GCM"
            encrypted_response.headers["X-Encryption-Key-ID"] = encrypted_payload["key_id"]

            return encrypted_response

        except Exception as e:
            # If encryption fails, log error and return original response
            print(f"❌ Encryption failed: {e}")

            # Return original response without Content-Length header
            # (Response class will recalculate it)
            headers_to_copy = {k: v for k, v in response.headers.items()
                             if k.lower() != 'content-length'}

            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=headers_to_copy
            )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using token bucket algorithm
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        # client_id -> (tokens, last_update)
        self.buckets = {}

    def get_client_id(self, request: Request) -> str:
        """Get client identifier (IP or user ID from JWT)"""
        # Try to get user from JWT (if authenticated)
        user_id = request.state.__dict__.get("user_id")
        if user_id:
            return f"user:{user_id}"

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0]}"

        return f"ip:{request.client.host}"

    def is_rate_limited(self, client_id: str) -> tuple[bool, dict]:
        """
        Check if client is rate limited using token bucket algorithm

        Returns:
            Tuple of (is_limited, rate_limit_info)
        """
        now = time.time()

        # Initialize bucket if doesn't exist
        if client_id not in self.buckets:
            self.buckets[client_id] = {
                "tokens": self.requests_per_minute,
                "last_update": now
            }

        bucket = self.buckets[client_id]

        # Calculate tokens to add based on time elapsed
        time_elapsed = now - bucket["last_update"]
        tokens_to_add = time_elapsed * (self.requests_per_minute / 60.0)

        # Update bucket
        bucket["tokens"] = min(
            self.requests_per_minute,
            bucket["tokens"] + tokens_to_add
        )
        bucket["last_update"] = now

        # Check if request can proceed
        if bucket["tokens"] >= 1.0:
            bucket["tokens"] -= 1.0
            is_limited = False
        else:
            is_limited = True

        # Rate limit info
        rate_limit_info = {
            "limit": self.requests_per_minute,
            "remaining": int(bucket["tokens"]),
            "reset": int(60 - (time_elapsed % 60))
        }

        return is_limited, rate_limit_info

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check rate limit before processing request"""
        client_id = self.get_client_id(request)
        is_limited, rate_limit_info = self.is_rate_limited(client_id)

        if is_limited:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Limit: {self.requests_per_minute} requests/minute",
                    "rate_limit": rate_limit_info
                },
                headers={
                    "X-RateLimit-Limit": str(rate_limit_info["limit"]),
                    "X-RateLimit-Remaining": str(rate_limit_info["remaining"]),
                    "X-RateLimit-Reset": str(rate_limit_info["reset"]),
                    "Retry-After": str(rate_limit_info["reset"])
                }
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(rate_limit_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_limit_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(rate_limit_info["reset"])

        return response
