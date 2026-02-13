"""
GitHub provider - PAT-based authentication, repos, workflow runs, deployments
"""
import asyncio
from typing import Dict, Any, List, Optional

from github import Github
from github.GithubException import BadCredentialsException, GithubException


def _get_github_client(credentials: Dict[str, Any]) -> Github:
    """Create GitHub client from credentials. credentials['pat'] or credentials['token']"""
    pat = credentials.get("pat") or credentials.get("token")
    if not pat:
        raise ValueError("credentials must contain 'pat' or 'token'")
    return Github(pat)


async def test_github_connection(credentials: Dict[str, Any]) -> Dict[str, Any]:
    """Validate PAT by getting user info. Returns {success: bool, user?: str, ...}"""
    def _sync():
        g = _get_github_client(credentials)
        user = g.get_user()
        return {"success": True, "user": user.login, "name": user.name or ""}

    try:
        result = await asyncio.to_thread(_sync)
        return result
    except BadCredentialsException as e:
        return {"success": False, "message": "Invalid PAT or token", "error": str(e)}
    except GithubException as e:
        return {"success": False, "message": str(e.data.get("message", str(e))), "error": type(e).__name__}
    except Exception as e:
        return {"success": False, "message": str(e), "error": type(e).__name__}


async def list_repos(credentials: Dict[str, Any], org: str) -> Dict[str, Any]:
    """List repositories for an organization. Returns {repos: [{name, full_name, ...}]}"""
    def _sync():
        g = _get_github_client(credentials)
        org_obj = g.get_organization(org)
        repos = list(org_obj.get_repos()[:50])
        return {
            "repos": [
                {"name": r.name, "full_name": r.full_name, "private": r.private}
                for r in repos
            ]
        }

    try:
        return await asyncio.to_thread(_sync)
    except Exception as e:
        return {"repos": [], "error": str(e)}


async def list_workflow_runs(
    credentials: Dict[str, Any],
    repo: str,
    limit: int = 20,
) -> Dict[str, Any]:
    """List recent workflow runs for a repo. repo = 'owner/repo'."""
    def _sync():
        g = _get_github_client(credentials)
        gh_repo = g.get_repo(repo)
        runs = list(gh_repo.get_workflow_runs()[:limit])
        return {
            "runs": [
                {
                    "id": str(r.id),
                    "name": r.name,
                    "status": r.status,
                    "conclusion": r.conclusion,
                    "head_sha": r.head_sha[:7] if r.head_sha else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "html_url": r.html_url,
                }
                for r in runs
            ]
        }

    try:
        return await asyncio.to_thread(_sync)
    except Exception as e:
        return {"runs": [], "error": str(e)}


async def get_deployment_status(
    credentials: Dict[str, Any],
    repo: str,
) -> Dict[str, Any]:
    """Get latest deployment status for a repo."""
    def _sync():
        g = _get_github_client(credentials)
        gh_repo = g.get_repo(repo)
        deployments = list(gh_repo.get_deployments()[:5])
        if not deployments:
            return {"deployments": [], "latest": None}
        latest = deployments[0]
        statuses = list(latest.get_statuses()[:1])
        status = statuses[0] if statuses else None
        return {
            "deployments": [
                {
                    "id": d.id,
                    "sha": d.sha[:7] if d.sha else None,
                    "environment": d.environment,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in deployments
            ],
            "latest": {
                "id": latest.id,
                "sha": latest.sha[:7] if latest.sha else None,
                "environment": latest.environment,
                "status": status.state if status else "unknown",
            } if latest else None,
        }

    try:
        return await asyncio.to_thread(_sync)
    except Exception as e:
        return {"deployments": [], "latest": None, "error": str(e)}
