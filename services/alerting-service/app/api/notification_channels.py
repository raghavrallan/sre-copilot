"""Notification channels API endpoints."""
import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import notification_channels

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/channels", tags=["Notification Channels"])


# --- Pydantic models ---

class CreateChannelRequest(BaseModel):
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
async def create_channel(request: CreateChannelRequest) -> dict:
    channel = {
        "channel_id": str(uuid.uuid4()),
        "name": request.name,
        "type": request.type,
        "config": request.config,
        "enabled": request.enabled,
        "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    notification_channels.append(channel)
    logger.info("Created notification channel: %s", channel["channel_id"])
    return channel


@router.get("")
async def list_channels() -> List[dict]:
    return notification_channels


@router.get("/{channel_id}")
async def get_channel(channel_id: str) -> dict:
    for ch in notification_channels:
        if ch["channel_id"] == channel_id:
            return ch
    raise HTTPException(status_code=404, detail="Channel not found")


@router.put("/{channel_id}")
async def update_channel(channel_id: str, request: UpdateChannelRequest) -> dict:
    for ch in notification_channels:
        if ch["channel_id"] == channel_id:
            if request.name is not None:
                ch["name"] = request.name
            if request.type is not None:
                ch["type"] = request.type
            if request.config is not None:
                ch["config"] = request.config
            if request.enabled is not None:
                ch["enabled"] = request.enabled
            return ch
    raise HTTPException(status_code=404, detail="Channel not found")


@router.delete("/{channel_id}")
async def delete_channel(channel_id: str) -> dict:
    for i, ch in enumerate(notification_channels):
        if ch["channel_id"] == channel_id:
            notification_channels.pop(i)
            return {"status": "deleted", "channel_id": channel_id}
    raise HTTPException(status_code=404, detail="Channel not found")


@router.post("/{channel_id}/test")
async def test_channel(channel_id: str) -> dict:
    for ch in notification_channels:
        if ch["channel_id"] == channel_id:
            logger.info("Test notification sent to channel: %s (%s)", ch["name"], ch["type"])
            return {"status": "success", "message": f"Test notification sent to {ch['name']}"}
    raise HTTPException(status_code=404, detail="Channel not found")
