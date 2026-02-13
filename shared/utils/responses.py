"""
Centralized HTTP response helpers and validation utilities.

All backend services should use these helpers to ensure consistent
status codes and response formats across the entire platform.

Usage:
    from shared.utils.responses import (
        success_response, error_response,
        validate_project_id, validate_required_fields, validate_uuid,
    )
"""
import uuid as _uuid
from typing import Any, Dict, List, Optional, Sequence, Union

from fastapi import HTTPException
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Standard error codes
# ---------------------------------------------------------------------------
MISSING_PROJECT_ID = "MISSING_PROJECT_ID"
MISSING_TENANT_ID = "MISSING_TENANT_ID"
INVALID_UUID = "INVALID_UUID"
MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD"
INVALID_FIELD_VALUE = "INVALID_FIELD_VALUE"
RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
VALIDATION_ERROR = "VALIDATION_ERROR"
SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
UNAUTHORIZED = "UNAUTHORIZED"


# ---------------------------------------------------------------------------
# Success response builder
# ---------------------------------------------------------------------------
def success_response(
    data: Any = None,
    message: str = "",
    total: Optional[int] = None,
    status_code: int = 200,
) -> JSONResponse:
    """
    Build a standard success response.

    For list endpoints the caller should pass ``total`` so the frontend
    knows exactly how many items matched.  When *data* is a list and
    *total* is not given, ``len(data)`` is used automatically.

    Returns a ``JSONResponse`` so the HTTP status code is set correctly.
    """
    body: Dict[str, Any] = {"status": "success"}

    if data is not None:
        body["data"] = data
    else:
        body["data"] = []

    if total is not None:
        body["total"] = total
    elif isinstance(data, (list, tuple)):
        body["total"] = len(data)

    if message:
        body["message"] = message

    return JSONResponse(status_code=status_code, content=body)


# ---------------------------------------------------------------------------
# Error response builder
# ---------------------------------------------------------------------------
def error_response(
    detail: str,
    status_code: int = 400,
    error_code: str = VALIDATION_ERROR,
) -> HTTPException:
    """
    Raise (or return) an ``HTTPException`` with a standard error body.

    Example usage::

        raise error_response("project_id is required", 400, MISSING_PROJECT_ID)
    """
    raise HTTPException(
        status_code=status_code,
        detail={
            "status": "error",
            "detail": detail,
            "error_code": error_code,
        },
    )


# ---------------------------------------------------------------------------
# Validators  (raise on failure, return cleaned value on success)
# ---------------------------------------------------------------------------

def validate_project_id(project_id: Optional[str], source: str = "query") -> str:
    """
    Validate that *project_id* is present and looks like a UUID.

    Args:
        project_id: The raw value from query param, header, or user context.
        source: Human-readable origin for the error message.

    Returns:
        The validated project_id string.

    Raises:
        HTTPException 400 when invalid.
    """
    if not project_id or not project_id.strip():
        raise error_response(
            f"project_id is required (from {source})",
            400,
            MISSING_PROJECT_ID,
        )
    pid = project_id.strip()
    try:
        _uuid.UUID(pid)
    except (ValueError, AttributeError):
        raise error_response(
            f"project_id must be a valid UUID, got: {pid!r}",
            400,
            INVALID_UUID,
        )
    return pid


def validate_uuid(value: Optional[str], field_name: str = "id") -> str:
    """
    Validate that *value* is a non-empty valid UUID string.

    Returns the validated string.
    Raises HTTPException 400 on failure.
    """
    if not value or not value.strip():
        raise error_response(
            f"{field_name} is required",
            400,
            MISSING_REQUIRED_FIELD,
        )
    v = value.strip()
    try:
        _uuid.UUID(v)
    except (ValueError, AttributeError):
        raise error_response(
            f"{field_name} must be a valid UUID, got: {v!r}",
            400,
            INVALID_UUID,
        )
    return v


def validate_required_fields(body: Dict[str, Any], fields: Sequence[str]) -> None:
    """
    Check that all *fields* exist and are non-empty in *body*.

    Raises HTTPException 400 listing every missing field at once.
    """
    missing = [f for f in fields if not body.get(f)]
    if missing:
        raise error_response(
            f"Missing required fields: {', '.join(missing)}",
            400,
            MISSING_REQUIRED_FIELD,
        )


def validate_enum(value: Any, allowed: Sequence[str], field_name: str) -> str:
    """
    Validate that *value* is one of the *allowed* values.

    Returns the validated value.
    Raises HTTPException 400 on failure.
    """
    if value not in allowed:
        raise error_response(
            f"Invalid value for {field_name}: {value!r}. Must be one of: {', '.join(allowed)}",
            400,
            INVALID_FIELD_VALUE,
        )
    return value


# ---------------------------------------------------------------------------
# FastAPI exception handler installer
# ---------------------------------------------------------------------------

def install_validation_handler(app) -> None:
    """
    Install a custom exception handler on *app* that converts FastAPI's
    default 422 ``RequestValidationError`` into a 400 response with our
    standard error envelope.

    Call once in each service's ``main.py``::

        from shared.utils.responses import install_validation_handler
        install_validation_handler(app)
    """
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def _handler(request, exc):
        errors = exc.errors() if hasattr(exc, "errors") else []
        detail_parts = []
        for err in errors:
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            msg = err.get("msg", "")
            detail_parts.append(f"{loc}: {msg}" if loc else msg)
        detail = "; ".join(detail_parts) if detail_parts else str(exc)
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "detail": detail,
                "error_code": VALIDATION_ERROR,
            },
        )
