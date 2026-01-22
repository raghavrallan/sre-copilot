"""
Unit tests for Audit Service
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

# Import app
import sys
sys.path.insert(0, "services/audit-service")
from app.main import app


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_audit_log():
    """Sample audit log for testing"""
    return {
        "user_id": "user-123",
        "user_email": "test@example.com",
        "tenant_id": "tenant-123",
        "action": "incident.create",
        "resource_type": "incident",
        "resource_id": "incident-456",
        "changes": {
            "before": None,
            "after": {"title": "Test Incident", "severity": "critical"}
        },
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0",
        "request_id": "req-789",
        "success": True
    }


class TestAuditServiceHealth:
    """Test Audit service health endpoint"""

    def test_health_endpoint(self, client):
        """Test health check returns 200"""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "audit-service"
        assert "total_logs" in data
        assert "timestamp" in data


class TestAuditLogCreation:
    """Test audit log creation"""

    def test_create_audit_log(self, client, sample_audit_log):
        """Test creating an audit log"""
        response = client.post("/audit-logs", json=sample_audit_log)
        assert response.status_code == 200

        data = response.json()
        assert "id" in data
        assert data["user_id"] == sample_audit_log["user_id"]
        assert data["action"] == sample_audit_log["action"]
        assert data["resource_type"] == sample_audit_log["resource_type"]
        assert data["success"] == sample_audit_log["success"]

    def test_create_audit_log_fields(self, client, sample_audit_log):
        """Test all fields are saved correctly"""
        response = client.post("/audit-logs", json=sample_audit_log)
        data = response.json()

        # Check all fields are present
        assert data["user_email"] == sample_audit_log["user_email"]
        assert data["tenant_id"] == sample_audit_log["tenant_id"]
        assert data["ip_address"] == sample_audit_log["ip_address"]
        assert data["user_agent"] == sample_audit_log["user_agent"]
        assert data["changes"] == sample_audit_log["changes"]

    def test_create_audit_log_timestamp(self, client, sample_audit_log):
        """Test timestamp is automatically added"""
        response = client.post("/audit-logs", json=sample_audit_log)
        data = response.json()

        assert "timestamp" in data
        # Verify timestamp is valid ISO format
        timestamp = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
        assert isinstance(timestamp, datetime)


class TestAuditLogRetrieval:
    """Test audit log retrieval and filtering"""

    def test_get_audit_logs_requires_tenant(self, client):
        """Test getting logs requires tenant_id"""
        response = client.get("/audit-logs")
        assert response.status_code == 422  # Validation error

    def test_get_audit_logs_with_tenant(self, client, sample_audit_log):
        """Test getting logs with tenant_id"""
        # Create a log first
        client.post("/audit-logs", json=sample_audit_log)

        response = client.get(f"/audit-logs?tenant_id={sample_audit_log['tenant_id']}")
        assert response.status_code == 200

        data = response.json()
        assert "total" in data
        assert "logs" in data
        assert isinstance(data["logs"], list)

    def test_filter_by_user_id(self, client, sample_audit_log):
        """Test filtering logs by user_id"""
        client.post("/audit-logs", json=sample_audit_log)

        response = client.get(
            f"/audit-logs?tenant_id={sample_audit_log['tenant_id']}&user_id={sample_audit_log['user_id']}"
        )
        assert response.status_code == 200

        data = response.json()
        for log in data["logs"]:
            assert log["user_id"] == sample_audit_log["user_id"]

    def test_filter_by_action(self, client, sample_audit_log):
        """Test filtering logs by action"""
        client.post("/audit-logs", json=sample_audit_log)

        response = client.get(
            f"/audit-logs?tenant_id={sample_audit_log['tenant_id']}&action={sample_audit_log['action']}"
        )
        assert response.status_code == 200

        data = response.json()
        for log in data["logs"]:
            assert log["action"] == sample_audit_log["action"]

    def test_pagination(self, client, sample_audit_log):
        """Test pagination works"""
        # Create multiple logs
        for i in range(10):
            log = sample_audit_log.copy()
            log["resource_id"] = f"incident-{i}"
            client.post("/audit-logs", json=log)

        # Get first page
        response = client.get(
            f"/audit-logs?tenant_id={sample_audit_log['tenant_id']}&limit=5&skip=0"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) <= 5

        # Get second page
        response = client.get(
            f"/audit-logs?tenant_id={sample_audit_log['tenant_id']}&limit=5&skip=5"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) <= 5


class TestAuditLogStats:
    """Test audit log statistics"""

    def test_get_stats(self, client, sample_audit_log):
        """Test getting audit statistics"""
        # Create some logs
        for i in range(5):
            log = sample_audit_log.copy()
            log["resource_id"] = f"incident-{i}"
            log["success"] = i % 2 == 0  # Mix of success/failure
            client.post("/audit-logs", json=log)

        response = client.get(f"/audit-logs/stats?tenant_id={sample_audit_log['tenant_id']}")
        assert response.status_code == 200

        data = response.json()
        assert "total_events" in data
        assert "successful_events" in data
        assert "failed_events" in data
        assert "success_rate" in data
        assert "top_actions" in data
        assert "top_users" in data

    def test_stats_calculations(self, client, sample_audit_log):
        """Test statistics are calculated correctly"""
        # Create logs with known success/failure pattern
        for i in range(10):
            log = sample_audit_log.copy()
            log["resource_id"] = f"incident-{i}"
            log["success"] = i < 7  # 7 successful, 3 failed
            client.post("/audit-logs", json=log)

        response = client.get(f"/audit-logs/stats?tenant_id={sample_audit_log['tenant_id']}")
        data = response.json()

        assert data["successful_events"] == 7
        assert data["failed_events"] == 3
        assert data["total_events"] == 10


class TestUserActivity:
    """Test user activity tracking"""

    def test_get_user_activity(self, client, sample_audit_log):
        """Test getting user activity"""
        client.post("/audit-logs", json=sample_audit_log)

        response = client.get(
            f"/audit-logs/user/{sample_audit_log['user_id']}/activity?tenant_id={sample_audit_log['tenant_id']}"
        )
        assert response.status_code == 200

        data = response.json()
        assert "user_id" in data
        assert "total_activities" in data
        assert "recent_activities" in data


class TestResourceHistory:
    """Test resource history tracking"""

    def test_get_resource_history(self, client, sample_audit_log):
        """Test getting resource history"""
        # Create multiple logs for same resource
        for i in range(3):
            log = sample_audit_log.copy()
            log["action"] = f"incident.update"
            log["changes"] = {
                "before": {"state": f"state-{i}"},
                "after": {"state": f"state-{i+1}"}
            }
            client.post("/audit-logs", json=log)

        response = client.get(
            f"/audit-logs/resource/{sample_audit_log['resource_type']}/{sample_audit_log['resource_id']}/history"
            f"?tenant_id={sample_audit_log['tenant_id']}"
        )
        assert response.status_code == 200

        data = response.json()
        assert "resource_type" in data
        assert "resource_id" in data
        assert "total_events" in data
        assert "history" in data
        assert data["total_events"] >= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
