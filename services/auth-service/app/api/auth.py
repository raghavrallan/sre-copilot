"""
Authentication endpoints
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from django.utils import timezone
import uuid

from shared.models.tenant import User, Tenant
from app.core.security import verify_password, get_password_hash, create_access_token, verify_token

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    tenant_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new user and tenant"""
    # Check if user already exists
    if await User.objects.filter(email=request.email).aexists():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create tenant
    tenant_slug = request.tenant_name.lower().replace(" ", "-")
    tenant = await Tenant.objects.acreate(
        name=request.tenant_name,
        slug=tenant_slug,
        plan_type='starter'
    )

    # Create user
    hashed_password = get_password_hash(request.password)
    user = await User.objects.acreate(
        tenant=tenant,
        email=request.email,
        hashed_password=hashed_password,
        full_name=request.full_name,
        role='admin'  # First user is admin
    )

    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "tenant_id": str(tenant.id),
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(tenant.id),
            "tenant_name": tenant.name
        }
    }


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login user"""
    # Find user
    try:
        user = await User.objects.select_related('tenant').aget(email=request.email)
    except User.DoesNotExist:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Verify password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check if user is active
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is disabled")

    # Update last login
    user.last_login_at = timezone.now()
    await user.asave()

    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "tenant_id": str(user.tenant.id),
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(user.tenant.id),
            "tenant_name": user.tenant.name
        }
    }


@router.get("/verify")
async def verify(authorization: Optional[str] = Header(None)):
    """Verify JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")

    # Extract token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = parts[1]

    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return payload


@router.get("/me")
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Extract and verify token
    parts = authorization.split()
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = parts[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get user
    try:
        user = await User.objects.select_related('tenant').aget(id=payload["sub"])
        return {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(user.tenant.id),
            "tenant_name": user.tenant.name
        }
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found")
