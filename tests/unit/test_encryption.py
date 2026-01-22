"""
Unit tests for Encryption Module
"""
import pytest
import json
from datetime import datetime

# Import encryption module
import sys
sys.path.insert(0, "services/api-gateway")
from app.core.security.encryption import EncryptionManager, encryption_manager


@pytest.fixture
def encryption_mgr():
    """Encryption manager fixture"""
    return EncryptionManager(master_key="test-master-key-for-testing")


class TestEncryptionManager:
    """Test EncryptionManager class"""

    def test_derive_key(self, encryption_mgr):
        """Test key derivation"""
        salt = b"test-salt-16byte"
        key = encryption_mgr.derive_key(salt)

        assert isinstance(key, bytes)
        assert len(key) == 32  # AES-256 requires 32-byte key

    def test_derive_key_deterministic(self, encryption_mgr):
        """Test key derivation is deterministic"""
        salt = b"test-salt-16byte"
        key1 = encryption_mgr.derive_key(salt)
        key2 = encryption_mgr.derive_key(salt)

        assert key1 == key2

    def test_generate_session_key(self, encryption_mgr):
        """Test session key generation"""
        key_id, key = encryption_mgr.generate_session_key()

        assert isinstance(key_id, str)
        assert isinstance(key, bytes)
        assert len(key) == 32
        assert key_id in encryption_mgr.session_keys

    def test_get_session_key(self, encryption_mgr):
        """Test retrieving session key"""
        key_id, key = encryption_mgr.generate_session_key()
        retrieved_key = encryption_mgr.get_session_key(key_id)

        assert retrieved_key == key

    def test_get_nonexistent_key_raises_error(self, encryption_mgr):
        """Test getting non-existent key raises error"""
        with pytest.raises(ValueError, match="Session key not found"):
            encryption_mgr.get_session_key("nonexistent-key-id")


class TestEncryptionDecryption:
    """Test encryption and decryption"""

    def test_encrypt_data(self, encryption_mgr):
        """Test encrypting data"""
        data = {"message": "Hello, World!", "number": 42}
        encrypted = encryption_mgr.encrypt_data(data)

        assert encrypted["encrypted"] is True
        assert encrypted["algorithm"] == "AES-256-GCM"
        assert "key_id" in encrypted
        assert "iv" in encrypted
        assert "data" in encrypted
        assert "timestamp" in encrypted

    def test_encrypt_decrypt_roundtrip(self, encryption_mgr):
        """Test encrypt-decrypt roundtrip"""
        original_data = {
            "message": "Secret data",
            "number": 12345,
            "nested": {"key": "value"}
        }

        # Encrypt
        encrypted = encryption_mgr.encrypt_data(original_data)

        # Decrypt
        decrypted = encryption_mgr.decrypt_data(encrypted)

        assert decrypted == original_data

    def test_decrypt_with_wrong_key_fails(self, encryption_mgr):
        """Test decryption with wrong key fails"""
        data = {"message": "Secret"}

        # Encrypt with one key
        key_id1, key1 = encryption_mgr.generate_session_key()
        encrypted = encryption_mgr.encrypt_data(data, key1)

        # Try to decrypt with different key
        key_id2, key2 = encryption_mgr.generate_session_key()
        with pytest.raises(ValueError, match="Decryption failed"):
            encryption_mgr.decrypt_data(encrypted, key2)

    def test_decrypt_non_encrypted_payload_fails(self, encryption_mgr):
        """Test decrypting non-encrypted payload fails"""
        non_encrypted = {"encrypted": False, "data": "plain text"}

        with pytest.raises(ValueError, match="Payload is not encrypted"):
            encryption_mgr.decrypt_data(non_encrypted)

    def test_encrypt_complex_data(self, encryption_mgr):
        """Test encrypting complex nested data"""
        complex_data = {
            "incidents": [
                {"id": "1", "title": "Incident 1", "severity": "critical"},
                {"id": "2", "title": "Incident 2", "severity": "high"}
            ],
            "metadata": {
                "total": 2,
                "timestamp": datetime.utcnow().isoformat()
            }
        }

        encrypted = encryption_mgr.encrypt_data(complex_data)
        decrypted = encryption_mgr.decrypt_data(encrypted)

        assert decrypted == complex_data

    def test_encrypt_empty_data(self, encryption_mgr):
        """Test encrypting empty data"""
        empty_data = {}

        encrypted = encryption_mgr.encrypt_data(empty_data)
        decrypted = encryption_mgr.decrypt_data(encrypted)

        assert decrypted == empty_data

    def test_encrypt_list_data(self, encryption_mgr):
        """Test encrypting list data"""
        list_data = [1, 2, 3, "four", {"five": 5}]

        encrypted = encryption_mgr.encrypt_data(list_data)
        decrypted = encryption_mgr.decrypt_data(encrypted)

        assert decrypted == list_data


class TestEncryptionPayloadFormat:
    """Test encryption payload format"""

    def test_encrypted_payload_structure(self, encryption_mgr):
        """Test encrypted payload has correct structure"""
        data = {"test": "data"}
        encrypted = encryption_mgr.encrypt_data(data)

        required_fields = ["encrypted", "algorithm", "key_id", "iv", "data", "timestamp"]
        for field in required_fields:
            assert field in encrypted

    def test_encrypted_data_is_base64(self, encryption_mgr):
        """Test encrypted data is base64 encoded"""
        import base64

        data = {"test": "data"}
        encrypted = encryption_mgr.encrypt_data(data)

        # Should be able to decode without error
        try:
            base64.b64decode(encrypted["data"])
            base64.b64decode(encrypted["iv"])
        except Exception:
            pytest.fail("Encrypted data is not valid base64")


class TestKeyManagement:
    """Test key management features"""

    def test_cleanup_expired_keys(self, encryption_mgr):
        """Test cleaning up expired keys"""
        # Generate a key
        key_id, _ = encryption_mgr.generate_session_key()

        # Manually expire it
        key, salt, expiry = encryption_mgr.session_keys[key_id]
        encryption_mgr.session_keys[key_id] = (
            key,
            salt,
            datetime(2020, 1, 1)  # Past date
        )

        # Cleanup
        encryption_mgr.cleanup_expired_keys()

        # Key should be removed
        assert key_id not in encryption_mgr.session_keys


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
