"""
Demo data generators for synthetic-service.
Generates demo monitors and 50+ results per monitor spanning last 24h.
"""
import logging
import random
import uuid
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


def generate_demo_monitors() -> list[dict[str, Any]]:
    """Generate demo monitors with initial data."""
    return [
        {
            "name": "API Gateway Health",
            "type": "ping",
            "url": "https://localhost:8580/health",
            "frequency_seconds": 60,
            "assertions": ["status_code == 200", "response_time < 500"],
            "headers": {},
            "method": "GET",
            "body": None,
            "enabled": True,
        },
        {
            "name": "Auth Service Health",
            "type": "ping",
            "url": "https://localhost:8501/health",
            "frequency_seconds": 60,
            "assertions": ["status_code == 200"],
            "headers": {},
            "method": "GET",
            "body": None,
            "enabled": True,
        },
        {
            "name": "Frontend Availability",
            "type": "ping",
            "url": "https://localhost:3000",
            "frequency_seconds": 120,
            "assertions": ["status_code == 200", "response_time < 2000"],
            "headers": {},
            "method": "GET",
            "body": None,
            "enabled": True,
        },
        {
            "name": "Incident API",
            "type": "api_test",
            "url": "https://localhost:8580/api/v1/incidents",
            "frequency_seconds": 120,
            "assertions": ["status_code == 200", "response_time < 1000"],
            "headers": {"Content-Type": "application/json"},
            "method": "GET",
            "body": None,
            "enabled": True,
        },
        {
            "name": "Login Endpoint",
            "type": "api_test",
            "url": "https://localhost:8580/api/v1/auth/login",
            "frequency_seconds": 300,
            "assertions": ["status_code in [200, 401]", "response_time < 2000"],
            "headers": {"Content-Type": "application/json"},
            "method": "POST",
            "body": '{"email":"test@example.com","password":"test"}',
            "enabled": True,
        },
    ]


def generate_demo_results(monitor_id: str, count: int = 55) -> list[dict[str, Any]]:
    """Generate 50+ demo results per monitor spanning last 24h."""
    results = []
    base_time = datetime.utcnow() - timedelta(hours=24)
    interval_minutes = (24 * 60) / max(count, 1)

    for i in range(count):
        ts = base_time + timedelta(minutes=i * interval_minutes + random.randint(0, 5))
        success = random.random() > 0.03  # ~97% success rate
        response_time = (
            random.randint(20, 250) if success else (random.randint(500, 5000) if random.random() > 0.5 else None)
        )
        status_code = 200 if success else random.choice([500, 502, 503, 504, 408])

        results.append({
            "result_id": str(uuid.uuid4()),
            "monitor_id": monitor_id,
            "timestamp": ts.isoformat() + "Z",
            "success": success,
            "response_time_ms": response_time,
            "status_code": status_code,
            "error_message": None if success else "Connection timeout" if status_code == 504 else "Internal server error",
            "assertions_passed": random.randint(0, 2) if success else 0,
            "assertions_total": 2,
        })

    results.sort(key=lambda x: x["timestamp"], reverse=True)
    return results
