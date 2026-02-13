"""
Background worker that periodically syncs cloud resources
"""
import asyncio
import logging
from django.utils import timezone

from shared.models import CloudConnection
from app.providers.azure import sync_azure_resources, sync_azure_metrics
from app.providers.aws import sync_aws_resources, sync_aws_metrics
from app.providers.gcp import sync_gcp_resources

logger = logging.getLogger(__name__)

SYNC_INTERVAL_SECONDS = 60
PROVIDER_SYNC = {
    "azure": (sync_azure_resources, sync_azure_metrics),
    "aws": (sync_aws_resources, sync_aws_metrics),
    "gcp": (sync_gcp_resources, lambda c: []),  # GCP metrics not implemented yet
}


async def run_sync_loop():
    """Runs every 60 seconds, syncs all active connections."""
    while True:
        try:
            await asyncio.sleep(SYNC_INTERVAL_SECONDS)
            await _sync_all_connections()
        except asyncio.CancelledError:
            logger.info("Sync loop cancelled")
            break
        except Exception as e:
            logger.exception("Sync loop error: %s", e)


async def _sync_all_connections():
    """Sync resources and metrics for all active cloud connections."""
    connections = list(CloudConnection.objects.filter(is_active=True))
    for conn in connections:
        try:
            conn.status = "syncing"
            conn.status_message = ""
            conn.save(update_fields=["status", "status_message"])

            if conn.provider not in PROVIDER_SYNC:
                conn.status = "error"
                conn.status_message = f"Unknown provider: {conn.provider}"
                conn.save(update_fields=["status", "status_message"])
                continue

            sync_resources, sync_metrics = PROVIDER_SYNC[conn.provider]
            resources = await sync_resources(conn)
            metrics = await sync_metrics(conn)

            conn.status = "connected"
            conn.status_message = ""
            conn.resources_count = len(resources)
            conn.last_sync_at = timezone.now()
            conn.save(update_fields=["status", "status_message", "resources_count", "last_sync_at"])
        except Exception as e:
            conn.status = "error"
            conn.status_message = str(e)[:500]
            conn.save(update_fields=["status", "status_message"])
            logger.warning("Sync failed for connection %s: %s", conn.id, e)
