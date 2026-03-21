"""
Jenkins provider - Username + API token authentication via Jenkins REST API
"""
import httpx
from typing import Dict, Any


async def test_jenkins_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Validate Jenkins credentials by calling the /me/api/json endpoint."""
    url = (credentials.get("url") or "").rstrip("/")
    username = credentials.get("username") or ""
    token = credentials.get("token") or credentials.get("pat") or ""

    if not url:
        return {"success": False, "message": "Jenkins URL is required"}
    if not username or not token:
        return {"success": False, "message": "Username and API token are required"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{url}/me/api/json",
                auth=(username, token),
                headers={"Accept": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "user": data.get("fullName", data.get("id", username)),
                }
            if resp.status_code in (401, 403):
                return {"success": False, "message": "Invalid username or API token"}
            return {"success": False, "message": f"Jenkins API returned HTTP {resp.status_code}"}
    except httpx.ConnectError:
        return {"success": False, "message": f"Cannot connect to {url}"}
    except Exception as e:
        return {"success": False, "message": str(e), "error": type(e).__name__}


async def list_jenkins_jobs(credentials: Dict[str, Any], limit: int = 50) -> Dict[str, Any]:
    """List Jenkins jobs."""
    url = (credentials.get("url") or "").rstrip("/")
    username = credentials.get("username") or ""
    token = credentials.get("token") or credentials.get("pat") or ""

    if not url or not username or not token:
        return {"pipelines": [], "error": "Credentials incomplete"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{url}/api/json",
                auth=(username, token),
                params={"tree": f"jobs[name,url,color]{{0,{limit}}}"},
                headers={"Accept": "application/json"},
            )
            if resp.status_code != 200:
                return {"pipelines": [], "error": resp.text or str(resp.status_code)}
            data = resp.json()
            jobs = data.get("jobs", [])
            return {
                "pipelines": [
                    {
                        "name": j.get("name"),
                        "url": j.get("url"),
                        "color": j.get("color"),
                    }
                    for j in jobs
                ]
            }
    except Exception as e:
        return {"pipelines": [], "error": str(e)}
