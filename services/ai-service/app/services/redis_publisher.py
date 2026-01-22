"""
Redis Publisher for broadcasting incident and hypothesis events
"""
import redis.asyncio as aioredis
import json
from typing import Optional
from datetime import datetime


class RedisPublisher:
    """Publishes events to Redis Pub/Sub for WebSocket broadcasting"""

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            print("✅ Connected to Redis for publishing")
        except Exception as e:
            print(f"❌ Failed to connect to Redis: {e}")

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()

    async def publish_incident_created(self, incident_data: dict, tenant_id: str):
        """Publish incident.created event"""
        await self._publish("incidents", {
            "type": "incident.created",
            "data": incident_data,
            "tenant_id": tenant_id
        })

    async def publish_incident_updated(self, incident_data: dict, tenant_id: str):
        """Publish incident.updated event"""
        await self._publish("incidents", {
            "type": "incident.updated",
            "data": incident_data,
            "tenant_id": tenant_id
        })

    async def publish_hypothesis_generated(self, hypothesis_data: dict, tenant_id: str):
        """Publish hypothesis.generated event"""
        await self._publish("hypotheses", {
            "type": "hypothesis.generated",
            "data": hypothesis_data,
            "tenant_id": tenant_id
        })

    async def _publish(self, channel: str, message: dict):
        """Publish message to Redis channel"""
        if not self.redis:
            print("⚠️  Redis not connected, skipping publish")
            return

        try:
            message["timestamp"] = datetime.utcnow().isoformat()
            await self.redis.publish(channel, json.dumps(message))
            print(f"📨 Published {message['type']} to channel '{channel}'")
        except Exception as e:
            print(f"❌ Failed to publish message: {e}")


# Global publisher instance
redis_publisher = RedisPublisher()
