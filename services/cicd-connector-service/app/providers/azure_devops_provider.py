"""
Azure DevOps provider - PAT-based authentication, pipelines, runs
"""
import asyncio
from typing import Dict, Any, List

import httpx


def _get_auth_header(credentials: Dict[str, Any]) -> str:
    """Build Azure DevOps PAT auth. credentials['pat'] required."""
    pat = credentials.get("pat") or credentials.get("token")
    if not pat:
        raise ValueError("credentials must contain 'pat' or 'token'")
    import base64
    auth = base64.b64encode(f":{pat}".encode()).decode()
    return f"Basic {auth}"


async def test_azdo_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Validate PAT by calling Azure DevOps connection data API."""
    auth = _get_auth_header(credentials)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://dev.azure.com/_apis/connectiondata",
            headers={
                "Authorization": auth,
                "Accept": "application/json",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            authenticated_user = data.get("authenticatedUser", {})
            return {
                "success": True,
                "user": authenticated_user.get("displayName", ""),
                "id": authenticated_user.get("id", ""),
            }
        return {
            "success": False,
            "message": resp.text or f"HTTP {resp.status_code}",
            "error": "AuthenticationFailed",
        }


async def list_pipelines(
    credentials: Dict[str, Any],
    org: str,
    project: str,
) -> Dict[str, Any]:
    """List pipelines for an Azure DevOps project."""
    auth = _get_auth_header(credentials)
    url = f"https://dev.azure.com/{org}/{project}/_apis/pipelines?api-version=7.1"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={"Authorization": auth, "Accept": "application/json"},
        )
        if resp.status_code != 200:
            return {"pipelines": [], "error": resp.text or str(resp.status_code)}
        data = resp.json()
        pipelines = data.get("value", [])
        return {
            "pipelines": [
                {
                    "id": str(p.get("id")),
                    "name": p.get("name"),
                    "folder": p.get("folder"),
                }
                for p in pipelines
            ]
        }


async def list_pipeline_runs(
    credentials: Dict[str, Any],
    org: str,
    project: str,
    pipeline_id: str,
    limit: int = 20,
) -> Dict[str, Any]:
    """List pipeline runs for a given pipeline."""
    auth = _get_auth_header(credentials)
    url = f"https://dev.azure.com/{org}/{project}/_apis/pipelines/{pipeline_id}/runs?api-version=7.1&$top={limit}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={"Authorization": auth, "Accept": "application/json"},
        )
        if resp.status_code != 200:
            return {"runs": [], "error": resp.text or str(resp.status_code)}
        data = resp.json()
        runs = data.get("value", [])
        return {
            "runs": [
                {
                    "id": str(r.get("id")),
                    "name": r.get("name"),
                    "state": r.get("state"),
                    "result": r.get("result"),
                    "sourceBranch": r.get("sourceBranch"),
                    "sourceVersion": (r.get("sourceVersion") or "")[:7],
                    "createdDate": r.get("createdDate"),
                    "_links": r.get("_links", {}),
                }
                for r in runs
            ]
        }
