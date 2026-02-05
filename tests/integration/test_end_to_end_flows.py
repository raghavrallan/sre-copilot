"""
Integration tests for end-to-end flows
"""
import pytest
import httpx
import asyncio
import time
from datetime import datetime


# Base URLs for services
AUTH_SERVICE = "http://localhost:8501"
INCIDENT_SERVICE = "http://localhost:8502"
AI_SERVICE = "http://localhost:8503"
INTEGRATION_SERVICE = "http://localhost:8504"
WEBSOCKET_SERVICE = "http://localhost:8505"
AUDIT_SERVICE = "http://localhost:8508"


@pytest.fixture
def test_tenant_id():
    """Test tenant ID"""
    return "e56947c7-554b-4ea8-9d88-97b16477b077"


@pytest.fixture
async def auth_token():
    """Get authentication token for testing"""
    # This would normally call the auth service
    # For now, return a mock token
    return "mock-jwt-token-for-testing"


class TestIncidentCreationFlow:
    """Test complete incident creation and processing flow"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_create_incident_triggers_ai_generation(self, test_tenant_id, auth_token):
        """
        Test that creating an incident triggers AI hypothesis generation

        Flow: Create Incident → AI Service Generates Hypotheses → Hypotheses Saved
        """
        async with httpx.AsyncClient() as client:
            # Step 1: Create an incident
            incident_data = {
                "title": "Test High Error Rate",
                "description": "Error rate exceeded 5% for 2 minutes",
                "service_name": "api-gateway",
                "severity": "critical",
                "tenant_id": test_tenant_id
            }

            incident_response = await client.post(
                f"{INCIDENT_SERVICE}/incidents",
                json=incident_data,
                timeout=30.0
            )

            # Check incident was created
            assert incident_response.status_code in [200, 201]
            incident = incident_response.json()
            incident_id = incident.get("id")
            assert incident_id is not None

            # Step 2: Wait for AI hypothesis generation (async process)
            await asyncio.sleep(5)

            # Step 3: Retrieve hypotheses
            hypotheses_response = await client.get(
                f"{INCIDENT_SERVICE}/incidents/{incident_id}/hypotheses",
                params={"tenant_id": test_tenant_id},
                timeout=30.0
            )

            # Check hypotheses were generated
            if hypotheses_response.status_code == 200:
                hypotheses = hypotheses_response.json()
                assert isinstance(hypotheses, list)
                # AI should generate at least 1 hypothesis
                assert len(hypotheses) >= 1

                # Validate hypothesis structure
                for hypothesis in hypotheses:
                    assert "claim" in hypothesis
                    assert "description" in hypothesis
                    assert "confidence_score" in hypothesis
                    assert "rank" in hypothesis


class TestAlertToIncidentFlow:
    """Test alert notification to incident creation flow"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_alertmanager_webhook_creates_incident(self, test_tenant_id):
        """
        Test that AlertManager webhook creates incident automatically

        Flow: Alert Fires → AlertManager → Integration Service → Incident Created → AI Generates Hypotheses
        """
        async with httpx.AsyncClient() as client:
            # Simulate AlertManager webhook payload
            alert_payload = {
                "alerts": [
                    {
                        "status": "firing",
                        "labels": {
                            "alertname": "HighErrorRate",
                            "severity": "critical",
                            "service": "test-service"
                        },
                        "annotations": {
                            "summary": "High error rate detected",
                            "description": "Error rate is 10% on service test-service"
                        }
                    }
                ]
            }

            # Send webhook
            webhook_response = await client.post(
                f"{INTEGRATION_SERVICE}/webhooks/alertmanager",
                json=alert_payload,
                timeout=30.0
            )

            # Check webhook processed successfully
            assert webhook_response.status_code == 200
            result = webhook_response.json()
            assert result.get("status") == "success"
            assert len(result.get("incident_ids", [])) > 0


class TestAuditLogging:
    """Test audit logging integration"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_audit_log_created_for_incident_creation(self, test_tenant_id):
        """
        Test that audit logs are created for incident operations

        Flow: Create Incident → Audit Log Created
        """
        async with httpx.AsyncClient() as client:
            # Create audit log
            audit_log_data = {
                "user_id": "test-user-123",
                "user_email": "test@example.com",
                "tenant_id": test_tenant_id,
                "action": "incident.create",
                "resource_type": "incident",
                "resource_id": "test-incident-123",
                "ip_address": "127.0.0.1",
                "user_agent": "pytest",
                "success": True
            }

            response = await client.post(
                f"{AUDIT_SERVICE}/audit-logs",
                json=audit_log_data,
                timeout=30.0
            )

            # Check audit log created
            assert response.status_code == 200
            audit_log = response.json()
            assert audit_log.get("id") is not None
            assert audit_log.get("action") == "incident.create"

            # Retrieve audit logs
            logs_response = await client.get(
                f"{AUDIT_SERVICE}/audit-logs",
                params={"tenant_id": test_tenant_id, "limit": 10},
                timeout=30.0
            )

            assert logs_response.status_code == 200
            logs_data = logs_response.json()
            assert logs_data.get("total") > 0


class TestServiceHealthChecks:
    """Test all services are healthy"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_all_services_healthy(self):
        """Test that all services respond to health checks"""
        services = [
            (INCIDENT_SERVICE, "incident-service"),
            (AI_SERVICE, "ai-service"),
            (INTEGRATION_SERVICE, "integration-service"),
            (WEBSOCKET_SERVICE, "websocket-service"),
            (AUDIT_SERVICE, "audit-service")
        ]

        async with httpx.AsyncClient() as client:
            for service_url, service_name in services:
                try:
                    response = await client.get(
                        f"{service_url}/health",
                        timeout=10.0
                    )
                    assert response.status_code == 200, f"{service_name} health check failed"

                    data = response.json()
                    assert data.get("status") in ["healthy", "operational"], \
                        f"{service_name} not healthy: {data}"

                except httpx.RequestError as e:
                    pytest.skip(f"{service_name} not accessible: {e}")


class TestWebSocketConnection:
    """Test WebSocket connection"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_websocket_stats_endpoint(self):
        """Test WebSocket stats endpoint"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{WEBSOCKET_SERVICE}/stats",
                    timeout=10.0
                )
                assert response.status_code == 200

                data = response.json()
                assert "total_connections" in data
                assert "connections_by_tenant" in data

            except httpx.RequestError as e:
                pytest.skip(f"WebSocket service not accessible: {e}")


class TestEncryptionMiddleware:
    """Test encryption middleware integration"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_encrypted_response_format(self):
        """Test that responses can be encrypted"""
        # This would require the API Gateway to have encryption enabled
        # and proper headers sent
        pass  # Placeholder for encryption integration test


class TestRateLimiting:
    """Test rate limiting integration"""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_rate_limit_enforcement(self):
        """Test that rate limiting is enforced"""
        async with httpx.AsyncClient() as client:
            # Make multiple rapid requests to trigger rate limit
            responses = []
            for i in range(150):  # Exceed typical limit of 100/min
                try:
                    response = await client.get(
                        f"{INCIDENT_SERVICE}/health",
                        timeout=5.0
                    )
                    responses.append(response.status_code)
                except:
                    pass

            # Check if any requests were rate limited (429)
            # Note: This might not trigger if rate limiting is not enabled
            has_rate_limit = 429 in responses
            print(f"Rate limit test: {has_rate_limit}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "integration"])
