"""
WebSocket Connection Manager
"""
from fastapi import WebSocket
from typing import Dict, Set, List, Optional
from datetime import datetime
import json
import asyncio


class ConnectionManager:
    """Manages WebSocket connections with tenant isolation"""

    def __init__(self):
        # client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

        # client_id -> tenant_id
        self.client_tenants: Dict[str, str] = {}

        # client_id -> user_data
        self.client_data: Dict[str, dict] = {}

        # client_id -> Set[channel]
        self.client_subscriptions: Dict[str, Set[str]] = {}

        # tenant_id -> Set[client_id]
        self.tenant_connections: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, client_id: str, tenant_id: str, user_data: dict):
        """Register a new WebSocket connection"""
        self.active_connections[client_id] = websocket
        self.client_tenants[client_id] = tenant_id
        self.client_data[client_id] = user_data
        self.client_subscriptions[client_id] = set()

        # Add to tenant connections
        if tenant_id not in self.tenant_connections:
            self.tenant_connections[tenant_id] = set()
        self.tenant_connections[tenant_id].add(client_id)

    async def disconnect(self, client_id: str):
        """Disconnect a WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]

        tenant_id = self.client_tenants.get(client_id)
        if tenant_id and tenant_id in self.tenant_connections:
            self.tenant_connections[tenant_id].discard(client_id)
            if not self.tenant_connections[tenant_id]:
                del self.tenant_connections[tenant_id]

        self.client_tenants.pop(client_id, None)
        self.client_data.pop(client_id, None)
        self.client_subscriptions.pop(client_id, None)

    async def disconnect_all(self):
        """Disconnect all connections"""
        for client_id in list(self.active_connections.keys()):
            try:
                await self.active_connections[client_id].close()
            except:
                pass
        self.active_connections.clear()
        self.client_tenants.clear()
        self.client_data.clear()
        self.client_subscriptions.clear()
        self.tenant_connections.clear()

    async def subscribe(self, client_id: str, channels: List[str]):
        """Subscribe client to channels"""
        if client_id in self.client_subscriptions:
            self.client_subscriptions[client_id].update(channels)

    async def unsubscribe(self, client_id: str, channels: List[str]):
        """Unsubscribe client from channels"""
        if client_id in self.client_subscriptions:
            self.client_subscriptions[client_id].difference_update(channels)

    async def send_personal_message(self, message: dict, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                print(f"Error sending to {client_id}: {e}")
                await self.disconnect(client_id)

    async def broadcast_to_tenant(self, message: dict, tenant_id: str, channel: Optional[str] = None):
        """Broadcast message to all clients in a tenant (optionally filtered by channel)"""
        if tenant_id not in self.tenant_connections:
            return

        for client_id in list(self.tenant_connections[tenant_id]):
            # Check if client is subscribed to this channel
            if channel and channel not in self.client_subscriptions.get(client_id, set()):
                continue

            await self.send_personal_message(message, client_id)

    async def broadcast_to_all(self, message: dict):
        """Broadcast message to all connected clients"""
        for client_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, client_id)

    def get_connection_count(self) -> int:
        """Get total number of active connections"""
        return len(self.active_connections)

    def get_connections_by_tenant(self) -> Dict[str, int]:
        """Get connection counts grouped by tenant"""
        return {
            tenant_id: len(clients)
            for tenant_id, clients in self.tenant_connections.items()
        }

    def is_connected(self, client_id: str) -> bool:
        """Check if client is connected"""
        return client_id in self.active_connections
