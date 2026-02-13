"""
Fernet encryption for cloud credentials
"""
import os
import json
import base64
from cryptography.fernet import Fernet, InvalidToken


_cached_fernet = None


def _get_fernet() -> Fernet:
    """Get Fernet instance from ENCRYPTION_KEY or MONITORING_ENCRYPTION_KEY env var"""
    global _cached_fernet
    if _cached_fernet is not None:
        return _cached_fernet
    key_str = os.getenv("ENCRYPTION_KEY") or os.getenv("MONITORING_ENCRYPTION_KEY")
    if not key_str:
        key_str = Fernet.generate_key().decode()
        import sys
        print("⚠️  WARNING: ENCRYPTION_KEY not set. Using auto-generated key. Set ENCRYPTION_KEY in .env", file=sys.stderr)
    key_bytes = key_str.encode() if isinstance(key_str, str) else key_str
    # Fernet key must be 32 url-safe base64-encoded bytes (44 chars)
    if len(key_bytes) != 44:
        key_bytes = base64.urlsafe_b64encode(key_bytes[:32].ljust(32, b'\0'))
    _cached_fernet = Fernet(key_bytes)
    return _cached_fernet


def encrypt_credentials(credentials: dict) -> str:
    """Encrypt credentials dict to Fernet-encrypted string"""
    f = _get_fernet()
    payload = json.dumps(credentials).encode()
    return f.encrypt(payload).decode()


def decrypt_credentials(encrypted: str) -> dict:
    """Decrypt Fernet-encrypted string to credentials dict"""
    if not encrypted:
        return {}
    try:
        f = _get_fernet()
        decrypted = f.decrypt(encrypted.encode())
        return json.loads(decrypted.decode())
    except (InvalidToken, ValueError) as e:
        raise ValueError(f"Failed to decrypt credentials: {e}")
