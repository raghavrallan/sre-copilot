"""
GCP provider - test connection, sync resources
"""
import asyncio
from typing import Any, Dict, List


async def test_gcp_connection(credentials: dict) -> dict:
    """Test GCP credentials. Returns status dict."""
    try:
        from google.cloud import resource_manager
        from google.oauth2 import service_account

        # Support service account JSON (file path or dict)
        creds_data = credentials.get("credentials") or credentials.get("service_account") or credentials
        if isinstance(creds_data, str):
            creds = service_account.Credentials.from_service_account_file(creds_data)
        elif isinstance(creds_data, dict):
            creds = service_account.Credentials.from_service_account_info(creds_data)
        else:
            return {"success": False, "message": "Credentials must be a JSON dict or file path"}

        client = resource_manager.Client(credentials=creds)
        # List projects to verify
        projects = list(client.list_projects(max_results=1))
        return {
            "success": True,
            "message": "GCP credentials validated successfully",
            "project_count": len(projects),
        }
    except ImportError as e:
        return {
            "success": False,
            "message": f"GCP SDK not installed: {e}. Install google-cloud-resource-manager and google-auth.",
            "error": "ImportError",
        }
    except Exception as e:
        err_msg = str(e)
        if "403" in err_msg or "Permission" in err_msg or "Invalid" in err_msg:
            return {"success": False, "message": "Invalid credentials or insufficient permissions", "error": type(e).__name__}
        return {"success": False, "message": err_msg, "error": type(e).__name__}


async def sync_gcp_resources(connection) -> list:
    """Pull resources from GCP project: Compute instances, GKE clusters, Cloud SQL."""
    resources = []
    try:
        from app.utils.encryption import decrypt_credentials
        from google.cloud import compute_v1
        from google.oauth2 import service_account

        creds = decrypt_credentials(connection.credentials_encrypted)
        project_id = creds.get("project_id") or creds.get("projectId") or connection.config.get("project_id")
        if not project_id:
            return []

        creds_data = creds.get("credentials") or creds.get("service_account") or creds
        if isinstance(creds_data, dict):
            credential = service_account.Credentials.from_service_account_info(creds_data)
        else:
            return []

        def _list_instances():
            client = compute_v1.InstancesClient(credentials=credential)
            request = compute_v1.AggregatedListInstancesRequest(project=project_id, max_results=100)
            instances = []
            for page in client.aggregated_list(request=request):
                for zone, zone_scoped in page.items():
                    if zone_scoped.instances:
                        for i in zone_scoped.instances:
                            instances.append({
                                "type": "compute_instance",
                                "id": i.id,
                                "name": i.name,
                                "zone": zone.replace("zones/", ""),
                                "status": i.status,
                            })
            return instances

        loop = asyncio.get_event_loop()
        resources = await loop.run_in_executor(None, _list_instances)
        # GKE and Cloud SQL would require additional client calls
    except ImportError:
        return []
    except Exception:
        return []
    return resources
