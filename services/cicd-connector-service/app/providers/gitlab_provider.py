"""
GitLab provider - PAT-based authentication via GitLab REST API v4
"""
import httpx
from typing import Dict, Any


async def test_gitlab_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a GitLab PAT by fetching the authenticated user."""
    pat = credentials.get("pat") or credentials.get("token")
    if not pat:
        return {"success": False, "message": "credentials must contain 'pat' or 'token'"}

    gitlab_url = (credentials.get("url") or "https://gitlab.com").rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{gitlab_url}/api/v4/user",
                headers={"PRIVATE-TOKEN": pat},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "user": data.get("username", ""),
                    "name": data.get("name", ""),
                }
            if resp.status_code == 401:
                return {"success": False, "message": "Invalid token or insufficient permissions"}
            return {"success": False, "message": f"GitLab API returned HTTP {resp.status_code}"}
    except httpx.ConnectError:
        return {"success": False, "message": f"Cannot connect to {gitlab_url}"}
    except Exception as e:
        return {"success": False, "message": str(e), "error": type(e).__name__}


async def list_gitlab_projects(credentials: Dict[str, Any], limit: int = 50) -> Dict[str, Any]:
    """List projects accessible to the PAT."""
    pat = credentials.get("pat") or credentials.get("token")
    if not pat:
        return {"repos": [], "error": "No PAT provided"}

    gitlab_url = (credentials.get("url") or "https://gitlab.com").rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{gitlab_url}/api/v4/projects",
                headers={"PRIVATE-TOKEN": pat},
                params={"membership": "true", "per_page": limit, "order_by": "last_activity_at"},
            )
            if resp.status_code != 200:
                return {"repos": [], "error": resp.text or str(resp.status_code)}
            projects = resp.json()
            return {
                "repos": [
                    {
                        "id": str(p.get("id")),
                        "name": p.get("name"),
                        "full_name": p.get("path_with_namespace"),
                        "web_url": p.get("web_url"),
                    }
                    for p in projects
                ]
            }
    except Exception as e:
        return {"repos": [], "error": str(e)}
