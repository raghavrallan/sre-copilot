"""
Background worker that periodically syncs cloud resources
"""
import asyncio
import logging
from asgiref.sync import sync_to_async
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


@sync_to_async
def _get_active_connections():
    """Fetch active connections from DB in a sync context."""
    return list(CloudConnection.objects.filter(is_active=True))


@sync_to_async
def _update_connection_status(conn_id, **fields):
    """Update connection fields in a sync context."""
    try:
        conn = CloudConnection.objects.get(id=conn_id)
        for key, value in fields.items():
            setattr(conn, key, value)
        conn.save(update_fields=list(fields.keys()))
    except CloudConnection.DoesNotExist:
        logger.warning("Connection %s not found during status update", conn_id)


async def _sync_all_connections():
    """Sync resources and metrics for all active cloud connections."""
    connections = await _get_active_connections()
    for conn in connections:
        try:
            await _update_connection_status(
                conn.id, status="syncing", status_message=""
            )

            if conn.provider not in PROVIDER_SYNC:
                await _update_connection_status(
                    conn.id,
                    status="error",
                    status_message=f"Unknown provider: {conn.provider}",
                )
                continue

            sync_resources, sync_metrics = PROVIDER_SYNC[conn.provider]
            resources = await sync_resources(conn)
            metrics = await sync_metrics(conn)

            await _update_connection_status(
                conn.id,
                status="connected",
                status_message="",
                resources_count=len(resources),
                last_sync_at=timezone.now(),
            )
        except Exception as e:
            await _update_connection_status(
                conn.id,
                status="error",
                status_message=str(e)[:500],
            )
            logger.warning("Sync failed for connection %s: %s", conn.id, e)
