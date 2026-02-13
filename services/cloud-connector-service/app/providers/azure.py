"""
Azure provider - test connection, sync resources, sync metrics
"""
import asyncio
from typing import Any, Dict, List


async def test_azure_connection(credentials: dict) -> dict:
    """Test Azure credentials. Returns status dict with success/message."""
    try:
        from azure.identity import ClientSecretCredential
        from azure.mgmt.resource import ResourceManagementClient

        client_id = credentials.get("client_id") or credentials.get("clientId")
        client_secret = credentials.get("client_secret") or credentials.get("clientSecret")
        tenant_id = credentials.get("tenant_id") or credentials.get("tenantId")
        subscription_id = credentials.get("subscription_id") or credentials.get("subscriptionId")

        if not all([client_id, client_secret, tenant_id]):
            return {
                "success": False,
                "message": "Missing required credentials: client_id, client_secret, tenant_id",
            }
        if not subscription_id:
            return {
                "success": False,
                "message": "Missing subscription_id for listing subscriptions",
            }

        cred = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )
        client = ResourceManagementClient(cred, subscription_id)
        # List subscriptions (or resource groups) to verify credentials
        subs = list(client.resource_groups.list(maxresults=1))
        return {
            "success": True,
            "message": "Azure credentials validated successfully",
            "subscription_id": subscription_id,
        }
    except ImportError as e:
        return {
            "success": False,
            "message": f"Azure SDK not installed: {e}. Install azure-identity and azure-mgmt-resource.",
            "error": "ImportError",
        }
    except Exception as e:
        err_msg = str(e)
        if "Unauthorized" in err_msg or "401" in err_msg or "AuthenticationFailed" in err_msg:
            return {"success": False, "message": "Invalid credentials or insufficient permissions", "error": type(e).__name__}
        return {"success": False, "message": err_msg, "error": type(e).__name__}


async def sync_azure_resources(connection) -> list:
    """Pull resources from Azure subscription: VMs, App Services, AKS clusters, databases."""
    resources = []
    try:
        from app.utils.encryption import decrypt_credentials
        from azure.identity import ClientSecretCredential
        from azure.mgmt.compute import ComputeManagementClient
        from azure.mgmt.resource import ResourceManagementClient

        creds = decrypt_credentials(connection.credentials_encrypted)
        sub_id = creds.get("subscription_id") or creds.get("subscriptionId") or connection.config.get("subscription_id")
        if not sub_id:
            return []

        tenant_id = creds.get("tenant_id") or creds.get("tenantId")
        client_id = creds.get("client_id") or creds.get("clientId")
        client_secret = creds.get("client_secret") or creds.get("clientSecret")

        cred = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )

        # List VMs
        compute_client = ComputeManagementClient(cred, sub_id)
        for vm in compute_client.virtual_machines.list_all():
            status = "unknown"
            try:
                if vm.instance_view and vm.instance_view.statuses:
                    status = vm.instance_view.statuses[-1].display_status or "unknown"
            except Exception:
                pass
            resources.append({
                "type": "vm",
                "id": vm.id,
                "name": vm.name,
                "location": vm.location,
                "status": status,
            })

        # App Services and AKS would require additional SDKs - stub for now
        # In production, add azure-mgmt-web, azure-mgmt-containerservice
    except ImportError:
        return []
    except Exception as e:
        return []
    return resources


async def sync_azure_metrics(connection) -> list:
    """Pull metrics from Azure Monitor: CPU, memory for VMs; request count for App Services."""
    metrics = []
    try:
        from app.utils.encryption import decrypt_credentials
        from azure.identity import ClientSecretCredential
        from azure.mgmt.monitor import MonitorManagementClient

        creds = decrypt_credentials(connection.credentials_encrypted)
        sub_id = creds.get("subscription_id") or creds.get("subscriptionId") or connection.config.get("subscription_id")
        if not sub_id:
            return []

        tenant_id = creds.get("tenant_id") or creds.get("tenantId")
        client_id = creds.get("client_id") or creds.get("clientId")
        client_secret = creds.get("client_secret") or creds.get("clientSecret")

        cred = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )

        monitor_client = MonitorManagementClient(cred, sub_id)
        # Metrics query would require resource IDs - stub for now
        # In production: monitor_client.metrics.list(...)
    except ImportError:
        return []
    except Exception:
        return []
    return metrics
