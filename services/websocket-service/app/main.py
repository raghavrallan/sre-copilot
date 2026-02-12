"""
WebSocket Service - Real-time bidirectional communication
"""
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
import uvicorn
import json
import asyncio

logger = logging.getLogger(__name__)
from typing import Dict, Set
from datetime import datetime

from app.websocket.connection_manager import ConnectionManager

from shared.utils.internal_auth import verify_internal_auth
from app.websocket.redis_pubsub import RedisPubSub
from app.core.auth import verify_token

app = FastAPI(
    title="WebSocket Service",
    description="Real-time bidirectional communication for SRE Copilot",
    version="2.0.0"
)

# Global connection manager
connection_manager = ConnectionManager()
redis_pubsub = RedisPubSub()


@app.on_event("startup")
async def startup_event():
    """Initialize Redis pub/sub on startup"""
    logger.info("WebSocket Service starting up")
    await redis_pubsub.connect()
    # Start listening to Redis pub/sub
    asyncio.create_task(redis_pubsub.listen(connection_manager))
    logger.info("WebSocket Service ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("WebSocket Service shutting down")
    await redis_pubsub.disconnect()
    await connection_manager.disconnect_all()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "websocket-service",
        "connections": connection_manager.get_connection_count(),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/stats")
async def get_stats(_auth: bool = Depends(verify_internal_auth)):
    """Get WebSocket connection statistics"""
    return {
        "total_connections": connection_manager.get_connection_count(),
        "connections_by_tenant": connection_manager.get_connections_by_tenant(),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    Main WebSocket endpoint for real-time communication

    Client must send authentication token on connection:
    {
        "type": "connect",
        "token": "jwt-token",
        "tenantId": "uuid"
    }
    """
    await websocket.accept()

    client_id = None
    tenant_id = None
    user_data = None

    try:
        # Wait for authentication message
        auth_message = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=10.0
        )

        if auth_message.get("type") != "connect":
            await websocket.send_json({
                "type": "error",
                "message": "First message must be 'connect' type with authentication"
            })
            await websocket.close(code=1008)
            return

        # Verify JWT token
        token = auth_message.get("token")
        tenant_id = auth_message.get("tenantId")

        if not token or not tenant_id:
            await websocket.send_json({
                "type": "error",
                "message": "Missing token or tenantId"
            })
            await websocket.close(code=1008)
            return

        try:
            user_data = verify_token(token)
            client_id = user_data.get("sub")  # User ID from JWT

            # Verify tenant matches
            if user_data.get("tenant_id") != tenant_id:
                await websocket.send_json({
                    "type": "error",
                    "message": "Tenant mismatch"
                })
                await websocket.close(code=1008)
                return

        except Exception as e:
            await websocket.send_json({
                "type": "error",
                "message": f"Authentication failed: {str(e)}"
            })
            await websocket.close(code=1008)
            return

        # Register connection
        await connection_manager.connect(websocket, client_id, tenant_id, user_data)

        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "clientId": client_id,
            "tenantId": tenant_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        logger.info("Client %s connected (tenant: %s)", client_id, tenant_id)

        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                await handle_client_message(websocket, client_id, tenant_id, data)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error("Error processing message from %s: %s", client_id, e)
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error processing message: {str(e)}"
                })

    except asyncio.TimeoutError:
        await websocket.send_json({
            "type": "error",
            "message": "Authentication timeout"
        })
        await websocket.close(code=1008)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        if client_id:
            await connection_manager.disconnect(client_id)
            logger.info("Client %s disconnected", client_id)


async def handle_client_message(websocket: WebSocket, client_id: str, tenant_id: str, data: dict):
    """Handle messages from client"""
    message_type = data.get("type")

    if message_type == "ping":
        # Heartbeat response
        await websocket.send_json({
            "type": "pong",
            "timestamp": datetime.utcnow().isoformat()
        })

    elif message_type == "subscribe":
        # Subscribe to channels
        channels = data.get("channels", [])
        await connection_manager.subscribe(client_id, channels)
        await websocket.send_json({
            "type": "subscribed",
            "channels": channels,
            "timestamp": datetime.utcnow().isoformat()
        })

    elif message_type == "unsubscribe":
        # Unsubscribe from channels
        channels = data.get("channels", [])
        await connection_manager.unsubscribe(client_id, channels)
        await websocket.send_json({
            "type": "unsubscribed",
            "channels": channels,
            "timestamp": datetime.utcnow().isoformat()
        })

    else:
        await websocket.send_json({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        })


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8505)
