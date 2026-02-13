"""
Settings/Connections backend API - manages connection configurations.
Uses Django ORM directly for ConnectionConfig CRUD.
"""
import json
import logging
import os
from django.utils import timezone
from typing import Any, Dict, List, Optional

from asgiref.sync import sync_to_async
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.proxy import get_current_user_from_token
from shared.models.connection_config import ConnectionConfig
from shared.models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", os.getenv("MONITORING_ENCRYPTION_KEY", ""))

# Keys to mask in config_display (sensitive fields)
SENSITIVE_KEYS = frozenset(
    {"password", "api_key", "secret", "token", "connection_string", "webhook_url"}
)

CATEGORIES = [
    "database",
    "redis",
    "notification_email",
    "notification_slack",
    "notification_pagerduty",
    "notification_teams",
    "notification_webhook",
    "observability_prometheus",
    "observability_grafana",
    "observability_alertmanager",
    "ai_openai",
    "ai_azure_openai",
]


def _get_fernet() -> Optional[Fernet]:
    """Get Fernet instance if key is configured."""
    key = ENCRYPTION_KEY.strip()
    if not key:
        return None
    try:
        key_bytes = key.encode() if isinstance(key, str) else key
        return Fernet(key_bytes)
    except Exception:
        return None


def _encrypt_config(config: dict) -> str:
    """Encrypt config dict to string. Raises if encryption not configured."""
    f = _get_fernet()
    if not f:
        raise HTTPException(
            status_code=500,
            detail="Encryption key not configured. Set ENCRYPTION_KEY or MONITORING_ENCRYPTION_KEY.",
        )
    return f.encrypt(json.dumps(config).encode()).decode()


def _decrypt_config(encrypted: str) -> dict:
    """Decrypt config string to dict."""
    if not encrypted:
        return {}
    f = _get_fernet()
    if not f:
        raise HTTPException(
            status_code=500,
            detail="Encryption key not configured. Set ENCRYPTION_KEY or MONITORING_ENCRYPTION_KEY.",
        )
    try:
        return json.loads(f.decrypt(encrypted.encode()).decode())
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Failed to decrypt configuration.")


def _build_config_display(config: dict) -> dict:
    """Build non-sensitive config_display from config (mask secrets)."""
    display = {}
    for k, v in config.items():
        key_lower = k.lower()
        if any(s in key_lower for s in SENSITIVE_KEYS):
            display[k] = "***" if v else ""
        else:
            display[k] = v
    return display


def _require_auth(user: Optional[dict]) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    project_id = user.get("project_id")
    tenant_id = user.get("tenant_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="No project context.")
    return {"project_id": project_id, "tenant_id": tenant_id}


# -----------------------------------------------------------------------------
# GET /settings/connections - List all connections for project (config values masked)
# -----------------------------------------------------------------------------
@router.get("/connections")
async def list_connections(user=Depends(get_current_user_from_token)):
    ctx = _require_auth(user)
    project_id = ctx["project_id"]

    @sync_to_async
    def _list():
        conns = list(
            ConnectionConfig.objects.filter(project_id=project_id)
            .order_by("category", "name")
            .values(
                "id",
                "category",
                "name",
                "config_display",
                "is_active",
                "last_tested_at",
                "last_test_status",
                "created_at",
                "updated_at",
            )
        )
        for c in conns:
            c["id"] = str(c["id"])
            if c.get("last_tested_at"):
                c["last_tested_at"] = c["last_tested_at"].isoformat()
            if c.get("created_at"):
                c["created_at"] = c["created_at"].isoformat()
            if c.get("updated_at"):
                c["updated_at"] = c["updated_at"].isoformat()
        return conns

    return await _list()


# -----------------------------------------------------------------------------
# PUT /settings/connections - Create or update connection
# -----------------------------------------------------------------------------
@router.put("/connections")
async def create_or_update_connection(
    request: Request,
    user=Depends(get_current_user_from_token),
):
    ctx = _require_auth(user)
    project_id = ctx["project_id"]
    tenant_id = ctx["tenant_id"]
    body = await request.json()

    connection_id = body.get("id")
    category = body.get("category")
    name = body.get("name")
    config = body.get("config", {})

    if not category or category not in CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(CATEGORIES)}",
        )
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="name is required")

    config_display = _build_config_display(config)
    config_encrypted = _encrypt_config(config)

    @sync_to_async
    def _upsert():
        project = Project.objects.get(id=project_id)
        tenant = project.tenant
        if connection_id:
            try:
                conn = ConnectionConfig.objects.get(
                    id=connection_id, project_id=project_id
                )
                conn.category = category
                conn.name = name.strip()
                conn.config_encrypted = config_encrypted
                conn.config_display = config_display
                conn.save()
                return {
                    "id": str(conn.id),
                    "category": conn.category,
                    "name": conn.name,
                    "config_display": conn.config_display,
                    "is_active": conn.is_active,
                    "last_tested_at": conn.last_tested_at.isoformat() if conn.last_tested_at else None,
                    "last_test_status": conn.last_test_status,
                }
            except ConnectionConfig.DoesNotExist:
                raise HTTPException(status_code=404, detail="Connection not found")
        else:
            conn = ConnectionConfig.objects.create(
                project=project,
                tenant=tenant,
                category=category,
                name=name.strip(),
                config_encrypted=config_encrypted,
                config_display=config_display,
            )
            return {
                "id": str(conn.id),
                "category": conn.category,
                "name": conn.name,
                "config_display": conn.config_display,
                "is_active": conn.is_active,
                "last_tested_at": None,
                "last_test_status": "",
            }

    return await _upsert()


# -----------------------------------------------------------------------------
# DELETE /settings/connections/{id} - Delete connection
# -----------------------------------------------------------------------------
@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    user=Depends(get_current_user_from_token),
):
    ctx = _require_auth(user)
    project_id = ctx["project_id"]

    @sync_to_async
    def _delete():
        try:
            conn = ConnectionConfig.objects.get(id=connection_id, project_id=project_id)
            conn.delete()
            return {"ok": True}
        except ConnectionConfig.DoesNotExist:
            raise HTTPException(status_code=404, detail="Connection not found")

    return await _delete()


# -----------------------------------------------------------------------------
# POST /settings/connections/test - Test connection
# -----------------------------------------------------------------------------
@router.post("/connections/test")
async def test_connection(
    request: Request,
    user=Depends(get_current_user_from_token),
):
    ctx = _require_auth(user)
    project_id = ctx["project_id"]
    body = await request.json()

    connection_id = body.get("connection_id")
    category = body.get("category")
    config = body.get("config", {})

    if connection_id:
        # Test existing connection
        @sync_to_async
        def _get():
            try:
                conn = ConnectionConfig.objects.get(
                    id=connection_id, project_id=project_id
                )
                return conn
            except ConnectionConfig.DoesNotExist:
                return None

        conn = await _get()
        if not conn:
            raise HTTPException(status_code=404, detail="Connection not found")
        category = conn.category
        config = _decrypt_config(conn.config_encrypted)

    if not category or category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid or missing category")

    success, message = await _test_connection_by_category(category, config)

    if connection_id and (success or not success):
        # Update last_tested_at and last_test_status
        @sync_to_async
        def _update():
            conn = ConnectionConfig.objects.get(id=connection_id, project_id=project_id)
            conn.last_tested_at = timezone.now()
            conn.last_test_status = "success" if success else "failed"
            conn.save()

        await _update()

    return {"success": success, "message": message}


async def _test_connection_by_category(category: str, config: dict) -> tuple[bool, str]:
    """Test connection based on category. Returns (success, message)."""
    try:
        if category == "database":
            return await _test_postgres(config)
        if category == "redis":
            return await _test_redis(config)
        if category == "notification_slack":
            return await _test_slack(config)
        if category == "notification_webhook":
            return await _test_webhook(config)
        if category == "notification_pagerduty":
            return await _test_pagerduty(config)
        if category == "notification_teams":
            return await _test_teams(config)
        if category == "observability_prometheus":
            return await _test_prometheus(config)
        if category == "observability_grafana":
            return await _test_grafana(config)
        if category == "observability_alertmanager":
            return await _test_alertmanager(config)
        if category == "ai_openai":
            return await _test_openai(config)
        if category == "ai_azure_openai":
            return await _test_azure_openai(config)
        if category == "notification_email":
            return await _test_email(config)
        return False, f"Test not implemented for category: {category}"
    except Exception as e:
        logger.exception("Connection test failed: %s", e)
        return False, str(e)


async def _test_postgres(config: dict) -> tuple[bool, str]:
    import psycopg2

    @sync_to_async
    def _connect():
        psycopg2.connect(
            host=config.get("host", "localhost"),
            port=int(config.get("port", 5432)),
            dbname=config.get("dbname", config.get("database", "postgres")),
            user=config.get("user", "postgres"),
            password=config.get("password", ""),
            connect_timeout=5,
        ).close()

    await _connect()
    return True, "Connected successfully"


async def _test_redis(config: dict) -> tuple[bool, str]:
    import redis

    @sync_to_async
    def _ping():
        r = redis.Redis(
            host=config.get("host", "localhost"),
            port=int(config.get("port", 6379)),
            password=config.get("password") or None,
            db=int(config.get("db", 0)),
            socket_connect_timeout=5,
        )
        r.ping()

    await _ping()
    return True, "Ping successful"


async def _test_slack(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("webhook_url")
    if not url:
        return False, "webhook_url is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            url,
            json={"text": "SRE Copilot connection test"},
        )
        if r.status_code == 200:
            return True, "Webhook reachable"
        return False, f"Slack returned {r.status_code}: {r.text[:200]}"


async def _test_webhook(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("url")
    if not url:
        return False, "url is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            url,
            json={"event": "connection_test", "source": "sre-copilot"},
        )
        if r.status_code in (200, 201, 202, 204):
            return True, "Webhook reachable"
        return False, f"Webhook returned {r.status_code}"


async def _test_pagerduty(config: dict) -> tuple[bool, str]:
    import httpx

    api_key = config.get("api_key")
    if not api_key:
        return False, "api_key is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.pagerduty.com/users/me",
            headers={"Authorization": f"Token token={api_key}"},
        )
        if r.status_code == 200:
            return True, "API key valid"
        return False, f"PagerDuty returned {r.status_code}"


async def _test_teams(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("webhook_url")
    if not url:
        return False, "webhook_url is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            url,
            json={"@type": "MessageCard", "text": "SRE Copilot connection test"},
        )
        if r.status_code == 200:
            return True, "Webhook reachable"
        return False, f"Teams returned {r.status_code}"


async def _test_prometheus(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("url", config.get("base_url", "")).rstrip("/")
    if not url:
        return False, "url is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{url}/api/v1/status/config")
        if r.status_code == 200:
            return True, "Prometheus reachable"
        r = await client.get(f"{url}/-/healthy")
        if r.status_code == 200:
            return True, "Prometheus reachable"
        return False, f"Prometheus returned {r.status_code}"


async def _test_grafana(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("url", config.get("base_url", "")).rstrip("/")
    api_key = config.get("api_key", config.get("token", ""))
    if not url:
        return False, "url is required"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{url}/api/health", headers=headers or None)
        if r.status_code == 200:
            return True, "Grafana reachable"
        return False, f"Grafana returned {r.status_code}"


async def _test_alertmanager(config: dict) -> tuple[bool, str]:
    import httpx

    url = config.get("url", config.get("base_url", "")).rstrip("/")
    if not url:
        return False, "url is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{url}/api/v2/status")
        if r.status_code == 200:
            return True, "Alertmanager reachable"
        r = await client.get(f"{url}/-/healthy")
        if r.status_code == 200:
            return True, "Alertmanager reachable"
        return False, f"Alertmanager returned {r.status_code}"


async def _test_openai(config: dict) -> tuple[bool, str]:
    import httpx

    api_key = config.get("api_key", config.get("OPENAI_API_KEY", ""))
    if not api_key:
        return False, "api_key is required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        if r.status_code == 200:
            return True, "API key valid"
        return False, f"OpenAI returned {r.status_code}"


async def _test_azure_openai(config: dict) -> tuple[bool, str]:
    import httpx

    endpoint = config.get("endpoint", config.get("api_base", "")).rstrip("/")
    api_key = config.get("api_key", config.get("api_key", ""))
    if not endpoint or not api_key:
        return False, "endpoint and api_key are required"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{endpoint}/openai/deployments?api-version=2024-02-15-preview",
            headers={"api-key": api_key},
        )
        if r.status_code == 200:
            return True, "Azure OpenAI reachable"
        return False, f"Azure OpenAI returned {r.status_code}"


async def _test_email(config: dict) -> tuple[bool, str]:
    import smtplib

    host = config.get("host", config.get("smtp_host", "localhost"))
    port = int(config.get("port", config.get("smtp_port", 587)))
    user = config.get("user", config.get("username", ""))
    password = config.get("password", "")

    @sync_to_async
    def _connect():
        smtp = smtplib.SMTP(host, port, timeout=5)
        smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.quit()

    await _connect()
    return True, "SMTP connection successful"


# -----------------------------------------------------------------------------
# GET /settings/connections/categories - List available categories
# -----------------------------------------------------------------------------
@router.get("/connections/categories")
async def list_categories(user=Depends(get_current_user_from_token)):
    _require_auth(user)
    return {
        "categories": [
            {"id": c, "label": c.replace("_", " ").title()} for c in CATEGORIES
        ]
    }
