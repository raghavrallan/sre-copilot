"""
Unit tests for WebSocket Service
"""
import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import json
from datetime import datetime

# Import app
import sys
sys.path.insert(0, "services/websocket-service")
from app.main import app
from app.websocket.connection_manager import ConnectionManager


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def connection_manager():
    """Connection manager fixture"""
    return ConnectionManager()


class TestWebSocketHealth:
    """Test WebSocket service health endpoint"""

    def test_health_endpoint(self, client):
        """Test health check returns 200"""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "websocket-service"
        assert "connections" in data
        assert "timestamp" in data

    def test_health_endpoint_structure(self, client):
        """Test health check response structure"""
        response = client.get("/health")
        data = response.json()

        required_fields = ["status", "service", "connections", "timestamp"]
        for field in required_fields:
            assert field in data


class TestWebSocketStats:
    """Test WebSocket statistics endpoint"""

    def test_stats_endpoint(self, client):
        """Test stats endpoint returns 200"""
        response = client.get("/stats")
        assert response.status_code == 200

        data = response.json()
        assert "total_connections" in data
        assert "connections_by_tenant" in data
        assert "timestamp" in data

    def test_stats_initial_state(self, client):
        """Test stats show no connections initially"""
        response = client.get("/stats")
        data = response.json()

        assert data["total_connections"] == 0
        assert data["connections_by_tenant"] == {}


class TestConnectionManager:
    """Test ConnectionManager class"""

    @pytest.mark.asyncio
    async def test_connect(self, connection_manager):
        """Test connecting a client"""
        mock_websocket = object()  # Mock WebSocket object
        client_id = "test-client-1"
        tenant_id = "tenant-1"
        user_data = {"sub": client_id, "tenant_id": tenant_id}

        await connection_manager.connect(mock_websocket, client_id, tenant_id, user_data)

        assert connection_manager.is_connected(client_id)
        assert client_id in connection_manager.active_connections
        assert connection_manager.client_tenants[client_id] == tenant_id

    @pytest.mark.asyncio
    async def test_disconnect(self, connection_manager):
        """Test disconnecting a client"""
        mock_websocket = object()
        client_id = "test-client-2"
        tenant_id = "tenant-1"
        user_data = {"sub": client_id, "tenant_id": tenant_id}

        await connection_manager.connect(mock_websocket, client_id, tenant_id, user_data)
        assert connection_manager.is_connected(client_id)

        await connection_manager.disconnect(client_id)
        assert not connection_manager.is_connected(client_id)
        assert client_id not in connection_manager.active_connections

    @pytest.mark.asyncio
    async def test_subscribe_channels(self, connection_manager):
        """Test subscribing to channels"""
        mock_websocket = object()
        client_id = "test-client-3"
        tenant_id = "tenant-1"
        user_data = {"sub": client_id, "tenant_id": tenant_id}

        await connection_manager.connect(mock_websocket, client_id, tenant_id, user_data)

        channels = ["incidents", "hypotheses", "alerts"]
        await connection_manager.subscribe(client_id, channels)

        assert connection_manager.client_subscriptions[client_id] == set(channels)

    @pytest.mark.asyncio
    async def test_unsubscribe_channels(self, connection_manager):
        """Test unsubscribing from channels"""
        mock_websocket = object()
        client_id = "test-client-4"
        tenant_id = "tenant-1"
        user_data = {"sub": client_id, "tenant_id": tenant_id}

        await connection_manager.connect(mock_websocket, client_id, tenant_id, user_data)

        # Subscribe
        channels = ["incidents", "hypotheses", "alerts"]
        await connection_manager.subscribe(client_id, channels)
        assert len(connection_manager.client_subscriptions[client_id]) == 3

        # Unsubscribe
        await connection_manager.unsubscribe(client_id, ["alerts"])
        assert "alerts" not in connection_manager.client_subscriptions[client_id]
        assert len(connection_manager.client_subscriptions[client_id]) == 2

    def test_get_connection_count(self, connection_manager):
        """Test getting connection count"""
        assert connection_manager.get_connection_count() == 0

    def test_get_connections_by_tenant(self, connection_manager):
        """Test getting connections grouped by tenant"""
        tenant_stats = connection_manager.get_connections_by_tenant()
        assert isinstance(tenant_stats, dict)
        assert len(tenant_stats) == 0


class TestWebSocketAuthentication:
    """Test WebSocket authentication"""

    def test_connection_without_auth(self, client):
        """Test connection fails without authentication"""
        with pytest.raises(Exception):
            with client.websocket_connect("/ws"):
                pass

    def test_connection_with_invalid_token(self, client):
        """Test connection fails with invalid token"""
        with pytest.raises(Exception):
            with client.websocket_connect("/ws?token=invalid-token"):
                pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
