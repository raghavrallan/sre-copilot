"""
Security utilities - JWT and password hashing
"""
from datetime import datetime, timedelta
from typing import Optional
import secrets
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token types
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "type": TOKEN_TYPE_ACCESS,
        "jti": secrets.token_urlsafe(32)  # Unique token ID for revocation
    })
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token (longer expiry)"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)  # 7 days expiry

    to_encode.update({
        "exp": expire,
        "type": TOKEN_TYPE_REFRESH,
        "jti": secrets.token_urlsafe(32)
    })
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = TOKEN_TYPE_ACCESS) -> Optional[dict]:
    """Verify a JWT token and check its type"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        # Verify token type
        if payload.get("type") != token_type:
            return None

        return payload
    except JWTError:
        return None


def set_auth_cookies(response, access_token: str, refresh_token: str):
    """Set secure httpOnly cookies for authentication"""
    # Access token cookie (15 minutes)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevents JavaScript access (XSS protection)
        secure=settings.ENVIRONMENT == "production",  # HTTPS only in production
        samesite="lax",  # CSRF protection
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    # Refresh token cookie (7 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/v1/auth/refresh"  # Only sent to refresh endpoint
    )


def clear_auth_cookies(response):
    """Clear authentication cookies"""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh")
