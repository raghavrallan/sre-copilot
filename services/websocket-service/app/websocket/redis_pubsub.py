"""
Redis Pub/Sub integration for distributing WebSocket messages
"""
import redis.asyncio as aioredis
import json
import asyncio
from typing import Optional
from datetime import datetime


class RedisPubSub:
    """Redis Pub/Sub handler for WebSocket message distribution"""

    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        self.pubsub: Optional[aioredis.client.PubSub] = None

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            self.pubsub = self.redis.pubsub()

            # Subscribe to all channels
            await self.pubsub.subscribe(
                "incidents",
                "hypotheses",
                "alerts",
                "notifications",
                "system"
            )
            print("✅ Connected to Redis Pub/Sub")
        except Exception as e:
            print(f"❌ Failed to connect to Redis: {e}")

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()

    async def listen(self, connection_manager):
        """Listen for Redis pub/sub messages and forward to WebSocket clients"""
        if not self.pubsub:
            print("❌ Redis pub/sub not initialized")
            return

        print("👂 Listening for Redis pub/sub messages...")

        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    channel = message["channel"]
                    data = message["data"]

                    try:
                        # Parse message
                        parsed_data = json.loads(data)
                        tenant_id = parsed_data.get("tenant_id")

                        if not tenant_id:
                            print(f"⚠️  Message without tenant_id on channel {channel}")
                            continue

                        # Forward to WebSocket clients
                        await connection_manager.broadcast_to_tenant(
                            message=parsed_data,
                            tenant_id=tenant_id,
                            channel=channel
                        )

                        print(f"📤 Forwarded message on channel '{channel}' to tenant {tenant_id}")

                    except json.JSONDecodeError:
                        print(f"❌ Invalid JSON on channel {channel}: {data}")
                    except Exception as e:
                        print(f"❌ Error processing message: {e}")

        except asyncio.CancelledError:
            print("👋 Redis listener cancelled")
        except Exception as e:
            print(f"❌ Redis listener error: {e}")

    async def publish(self, channel: str, message: dict):
        """Publish message to Redis channel"""
        if not self.redis:
            print("❌ Redis not connected")
            return

        try:
            message["timestamp"] = datetime.utcnow().isoformat()
            await self.redis.publish(channel, json.dumps(message))
            print(f"📨 Published message to channel '{channel}'")
        except Exception as e:
            print(f"❌ Failed to publish message: {e}")
