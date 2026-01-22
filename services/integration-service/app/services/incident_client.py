"""
Client for incident-service API
"""
import httpx
from typing import Optional


INCIDENT_SERVICE_URL = "http://incident-service:8002"


class IncidentClient:
    """Client for creating incidents in incident-service"""

    def __init__(self):
        self.base_url = INCIDENT_SERVICE_URL

    async def create_incident(
        self,
        title: str,
        description: str,
        service_name: str,
        severity: str,
        tenant_id: str
    ) -> Optional[dict]:
        """
        Create a new incident

        Args:
            title: Incident title
            description: Incident description
            service_name: Service affected
            severity: Severity level (critical, warning, info)
            tenant_id: Tenant ID

        Returns:
            Created incident data or None if failed
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/incidents",
                    json={
                        "title": title,
                        "description": description,
                        "service_name": service_name,
                        "severity": severity,
                        "tenant_id": tenant_id
                    }
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Failed to create incident: {e}")
            return None
