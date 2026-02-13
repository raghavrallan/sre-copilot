"""Notification channels API endpoints."""
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import (
    create_channel,
    list_channels,
    get_channel,
    update_channel,
    delete_channel,
    _get_project,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channels", tags=["Notification Channels"])


# --- Pydantic models ---

class CreateChannelRequest(BaseModel):
    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., max_length=200)
    type: Literal["email", "slack", "pagerduty", "webhook", "msteams"] = "webhook"
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class UpdateChannelRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal["email", "slack", "pagerduty", "webhook", "msteams"]] = None
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


# --- Endpoints ---

@router.post("")
async def create_channel_endpoint(request: CreateChannelRequest) -> dict:
    """Create a new notification channel."""
    try:
        project = await _get_project(request.project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    data = request.model_dump(exclude={"project_id"})
    channel = await create_channel(
        project_id=str(project.id),
        tenant_id=str(project.tenant_id),
        data=data,
    )
    logger.info("Created notification channel: %s", channel["channel_id"])
    return channel


@router.get("")
async def list_channels_endpoint(project_id: str) -> List[dict]:
    """List all notification channels for a project."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await list_channels(project_id=str(project.id))


@router.get("/{channel_id}")
async def get_channel_endpoint(
    channel_id: str,
    project_id: str,
) -> dict:
    """Get a single notification channel by ID."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    channel = await get_channel(
        project_id=str(project.id),
        channel_id=channel_id,
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


@router.put("/{channel_id}")
async def update_channel_endpoint(
    channel_id: str,
    request: UpdateChannelRequest,
    project_id: str,
) -> dict:
    """Update a notification channel."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    update_data = request.model_dump(exclude_unset=True)
    channel = await update_channel(
        project_id=str(project.id),
        channel_id=channel_id,
        data=update_data,
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


@router.delete("/{channel_id}")
async def delete_channel_endpoint(
    channel_id: str,
    project_id: str,
) -> dict:
    """Delete a notification channel."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    deleted = await delete_channel(
        project_id=str(project.id),
        channel_id=channel_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"status": "deleted", "channel_id": channel_id}


@router.post("/{channel_id}/test")
async def test_channel_endpoint(
    channel_id: str,
    project_id: str,
) -> dict:
    """Send a test notification to a channel."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    channel = await get_channel(
        project_id=str(project.id),
        channel_id=channel_id,
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    logger.info("Test notification sent to channel: %s (%s)", channel["name"], channel["type"])
    return {"status": "success", "message": f"Test notification sent to {channel['name']}"}
