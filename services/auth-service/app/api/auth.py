"""
Authentication endpoints
"""
import re
from fastapi import APIRouter, HTTPException, Header, Response, Cookie
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from django.utils import timezone
import uuid

from shared.models.tenant import User, Tenant
from shared.models.project import Project, ProjectMember, ProjectRole
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    set_auth_cookies,
    set_access_token_cookie,
    clear_auth_cookies,
    TOKEN_TYPE_REFRESH
)

router = APIRouter()


def get_token_from_request(authorization: Optional[str] = None, access_token: Optional[str] = None) -> Optional[str]:
    """Extract token from Authorization header or cookie"""
    token = None
    # Try Authorization header first
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    # Fall back to cookie
    if not token and access_token:
        token = access_token
    return token


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    tenant_name: str

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    projects: list


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, response: Response):
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

    # Create default project
    default_project = await Project.objects.acreate(
        tenant=tenant,
        name="Default Project",
        slug="default",
        description="Your first project",
        is_active=True
    )

    # Add user as project owner
    await ProjectMember.objects.acreate(
        project=default_project,
        user=user,
        role=ProjectRole.OWNER
    )

    # Get user's projects
    projects = []
    async for membership in ProjectMember.objects.filter(user=user).select_related('project'):
        projects.append({
            "id": str(membership.project.id),
            "name": membership.project.name,
            "slug": membership.project.slug,
            "role": membership.role
        })

    # Create token data
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": str(tenant.id),
        "role": user.role,
        "project_id": str(default_project.id),
        "project_role": ProjectRole.OWNER
    }

    # Create access and refresh tokens
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Set secure httpOnly cookies
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,  # Still return for backward compatibility
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(tenant.id),
            "tenant_name": tenant.name,
            "current_project_id": str(default_project.id)
        },
        "projects": projects
    }


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, response: Response):
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

    # Get user's projects
    projects = []
    first_project = None
    first_project_role = None

    async for membership in ProjectMember.objects.filter(user=user).select_related('project'):
        project_data = {
            "id": str(membership.project.id),
            "name": membership.project.name,
            "slug": membership.project.slug,
            "role": membership.role,
            "is_active": membership.project.is_active
        }
        projects.append(project_data)

        # Set first active project as default
        if not first_project and membership.project.is_active:
            first_project = membership.project
            first_project_role = membership.role

    # If user has no projects, return error
    if not projects:
        raise HTTPException(status_code=403, detail="User has no project access. Contact admin.")

    # Create token data
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": str(user.tenant.id),
        "role": user.role,
        "project_id": str(first_project.id),
        "project_role": first_project_role
    }

    # Create access and refresh tokens
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Set secure httpOnly cookies
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,  # Still return for backward compatibility
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(user.tenant.id),
            "tenant_name": user.tenant.name,
            "current_project_id": str(first_project.id)
        },
        "projects": projects
    }


@router.post("/switch-project")
async def switch_project(
    project_id: str,
    response: Response,
    authorization: Optional[str] = Header(None)
):
    """Switch to a different project - returns new JWT"""
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
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user has access to this project
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    # Check if project is active
    if not membership.project.is_active:
        raise HTTPException(status_code=403, detail="Project is not active")

    # Create new access token with selected project
    new_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "tenant_id": str(user.tenant.id),
            "role": user.role,
            "project_id": str(membership.project.id),
            "project_role": membership.role
        }
    )

    # Set new access_token in httpOnly cookie
    set_access_token_cookie(response, new_token)

    return {
        "access_token": new_token,
        "token_type": "bearer",
        "project": {
            "id": str(membership.project.id),
            "name": membership.project.name,
            "slug": membership.project.slug,
            "role": membership.role
        }
    }


@router.get("/verify")
async def verify(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Verify JWT token (supports both header and cookie)"""
    token = get_token_from_request(authorization, access_token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return payload


@router.get("/me")
async def get_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Get current user info with projects (supports both header and cookie)"""
    token = get_token_from_request(authorization, access_token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get user
    try:
        user = await User.objects.select_related('tenant').aget(id=payload["sub"])

        # Get user's projects
        projects = []
        async for membership in ProjectMember.objects.filter(user=user).select_related('project'):
            projects.append({
                "id": str(membership.project.id),
                "name": membership.project.name,
                "slug": membership.project.slug,
                "role": membership.role,
                "is_active": membership.project.is_active
            })

        return {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": str(user.tenant.id),
            "tenant_name": user.tenant.name,
            "current_project_id": payload.get("project_id"),
            "current_project_role": payload.get("project_role"),
            "projects": projects
        }
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/refresh")
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None)
):
    """Refresh access token using refresh token"""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")

    # Verify refresh token
    payload = verify_token(refresh_token, token_type=TOKEN_TYPE_REFRESH)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Get user
    try:
        user = await User.objects.select_related('tenant').aget(id=payload["sub"])
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's first active project
    first_project = None
    first_project_role = None
    async for membership in ProjectMember.objects.filter(user=user).select_related('project'):
        if membership.project.is_active:
            first_project = membership.project
            first_project_role = membership.role
            break

    if not first_project:
        raise HTTPException(status_code=403, detail="User has no active project")

    # Create new access token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": str(user.tenant.id),
        "role": user.role,
        "project_id": str(first_project.id),
        "project_role": first_project_role
    }

    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Set new cookies
    set_auth_cookies(response, new_access_token, new_refresh_token)

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "message": "Token refreshed successfully"
    }


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing cookies"""
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/ws-token")
async def get_websocket_token(access_token: Optional[str] = Cookie(None)):
    """Get a short-lived token for WebSocket authentication"""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify access token
    payload = verify_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Return the access token for WebSocket use
    # WebSocket can use the same token since it's short-lived (15 min)
    return {
        "token": access_token,
        "user_id": payload.get("sub"),
        "tenant_id": payload.get("tenant_id"),
        "project_id": payload.get("project_id")
    }
