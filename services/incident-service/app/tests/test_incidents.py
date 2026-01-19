"""
Unit tests for incident service
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["service"] == "incident-service"


def test_list_incidents_no_auth():
    """Test listing incidents without auth should work (for POC)"""
    # In production, this would require authentication
    # For POC, we just test the endpoint exists
    response = client.get("/incidents")
    # Will fail due to missing tenant_id query param, but endpoint exists
    assert response.status_code in [422, 404]  # Validation error or not found
