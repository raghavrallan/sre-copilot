"""
End-to-End Encryption Module
Implements AES-256-GCM encryption for API responses
"""
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
import base64
import json
from typing import Dict, Any
from datetime import datetime, timedelta
import secrets


class EncryptionManager:
    """Manages encryption keys and provides encryption/decryption methods"""

    def __init__(self, master_key: str = None):
        """
        Initialize encryption manager

        Args:
            master_key: Master key for key derivation (from environment)
        """
        self.master_key = master_key or os.getenv(
            "ENCRYPTION_MASTER_KEY",
            ""
        )
        # Session keys cache: key_id -> (key, expiry)
        self.session_keys: Dict[str, tuple] = {}

    def derive_key(self, salt: bytes) -> bytes:
        """
        Derive encryption key from master key using PBKDF2

        Args:
            salt: Salt for key derivation

        Returns:
            32-byte derived key for AES-256
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return kdf.derive(self.master_key.encode())

    def generate_session_key(self) -> tuple[str, bytes]:
        """
        Generate a new session key for encryption

        Returns:
            Tuple of (key_id, key_bytes)
        """
        key_id = secrets.token_urlsafe(16)
        salt = secrets.token_bytes(16)
        key = self.derive_key(salt)

        # Cache with 24-hour expiry
        expiry = datetime.utcnow() + timedelta(hours=24)
        self.session_keys[key_id] = (key, salt, expiry)

        return key_id, key

    def get_session_key(self, key_id: str) -> bytes:
        """
        Retrieve session key by ID

        Args:
            key_id: Session key identifier

        Returns:
            Key bytes

        Raises:
            ValueError: If key not found or expired
        """
        if key_id not in self.session_keys:
            raise ValueError(f"Session key not found: {key_id}")

        key, salt, expiry = self.session_keys[key_id]

        if datetime.utcnow() > expiry:
            # Key expired, remove it
            del self.session_keys[key_id]
            raise ValueError(f"Session key expired: {key_id}")

        return key

    def cleanup_expired_keys(self):
        """Remove expired session keys"""
        now = datetime.utcnow()
        expired = [
            key_id
            for key_id, (_, _, expiry) in self.session_keys.items()
            if now > expiry
        ]
        for key_id in expired:
            del self.session_keys[key_id]

    def encrypt_data(self, data: Any, key: bytes = None) -> Dict[str, str]:
        """
        Encrypt data using AES-256-GCM

        Args:
            data: Data to encrypt (will be JSON serialized)
            key: Encryption key (generates new session key if not provided)

        Returns:
            Dictionary with encrypted payload and metadata
        """
        # Generate session key if not provided
        if key is None:
            key_id, key = self.generate_session_key()
        else:
            key_id = "provided"

        # Serialize data to JSON
        json_data = json.dumps(data, default=str)
        plaintext = json_data.encode('utf-8')

        # Generate random IV (12 bytes for GCM)
        iv = os.urandom(12)

        # Encrypt using AES-256-GCM
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(iv, plaintext, None)

        # Return encrypted payload
        return {
            "encrypted": True,
            "algorithm": "AES-256-GCM",
            "key_id": key_id,
            "iv": base64.b64encode(iv).decode('utf-8'),
            "data": base64.b64encode(ciphertext).decode('utf-8'),
            "timestamp": datetime.utcnow().isoformat()
        }

    def decrypt_data(self, encrypted_payload: Dict[str, str], key: bytes = None) -> Any:
        """
        Decrypt encrypted payload

        Args:
            encrypted_payload: Encrypted payload from encrypt_data
            key: Decryption key (retrieves from session if not provided)

        Returns:
            Decrypted data

        Raises:
            ValueError: If decryption fails
        """
        if not encrypted_payload.get("encrypted"):
            raise ValueError("Payload is not encrypted")

        # Get key
        if key is None:
            key_id = encrypted_payload.get("key_id")
            key = self.get_session_key(key_id)

        # Decode IV and ciphertext
        iv = base64.b64decode(encrypted_payload["iv"])
        ciphertext = base64.b64decode(encrypted_payload["data"])

        # Decrypt using AES-256-GCM
        aesgcm = AESGCM(key)
        try:
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
            json_data = plaintext.decode('utf-8')
            return json.loads(json_data)
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")


# Global encryption manager instance
encryption_manager = EncryptionManager()

# Validate critical secrets at startup
_PLACEHOLDER_SECRETS = {"your-secret-key-change-in-production", "change-this-master-key-in-production", ""}

def validate_encryption_secrets():
    """Validate that critical secrets are properly configured"""
    import logging
    logger = logging.getLogger(__name__)

    master_key = os.getenv("ENCRYPTION_MASTER_KEY", "")
    environment = os.getenv("ENVIRONMENT", "development")

    if master_key in _PLACEHOLDER_SECRETS:
        if environment == "production":
            raise ValueError("ENCRYPTION_MASTER_KEY must be set to a secure value in production")
        else:
            logger.warning("WARNING: ENCRYPTION_MASTER_KEY is using a placeholder value. Set a secure value for production.")

validate_encryption_secrets()
