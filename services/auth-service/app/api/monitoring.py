"""
Monitoring Integration Management API
Handles CRUD operations for Prometheus, Grafana, and AlertManager integrations
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Request
from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, List
from datetime import datetime
import httpx
from asgiref.sync import sync_to_async

from shared.models.monitoring_integration import MonitoringIntegration, MonitoringAlert
from shared.models.project import Project, ProjectMember, ProjectRole
from shared.models.tenant import User
from app.core.security import verify_token

router = APIRouter()


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class MonitoringIntegrationCreate(BaseModel):
    """Request model for creating a monitoring integration"""
    integration_type: str  # 'prometheus', 'grafana', 'alertmanager'
    name: str
    description: Optional[str] = None
    url: HttpUrl
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[Dict] = {}
    webhook_enabled: bool = True
    is_primary: bool = True


class MonitoringIntegrationUpdate(BaseModel):
    """Request model for updating a monitoring integration"""
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[HttpUrl] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[Dict] = None
    webhook_enabled: Optional[bool] = None
    status: Optional[str] = None
    is_primary: Optional[bool] = None


class MonitoringIntegrationResponse(BaseModel):
    """Response model for monitoring integration"""
    id: str
    project_id: str
    project_name: str
    integration_type: str
    integration_type_display: str
    name: str
    description: Optional[str]
    url: str
    username: Optional[str]
    config: Dict
    status: str
    status_display: str
    last_test_at: Optional[str]
    last_test_success: bool
    last_error_message: Optional[str]
    webhook_enabled: bool
    webhook_url: Optional[str]
    is_primary: bool
    created_at: str
    updated_at: str


class TestConnectionRequest(BaseModel):
    """Request to test a monitoring connection"""
    url: HttpUrl
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    integration_type: str


class TestConnectionResponse(BaseModel):
    """Response from connection test"""
    success: bool
    message: str
    details: Optional[Dict] = None
    response_time_ms: Optional[int] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Get current user from JWT token (supports both header and cookie)"""
    # Try to get token from Authorization header first
    token = None
    if authorization:
        token = authorization.replace("Bearer ", "")

    # If no header token, try cookie
    if not token and access_token:
        token = access_token

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_data = verify_token(token)

    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_data


@sync_to_async
def get_user_project(user_id: str, project_id: str):
    """Get project ensuring user has access"""
    try:
        user = User.objects.get(id=user_id)
        project = Project.objects.get(id=project_id)

        # Check if user is member of this project
        is_member = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user_id
        ).exists()

        if not is_member:
            return None

        return project
    except (User.DoesNotExist, Project.DoesNotExist):
        return None


async def test_prometheus_connection(url: str, username: str = None, password: str = None, api_key: str = None) -> TestConnectionResponse:
    """Test Prometheus connection"""
    try:
        start_time = datetime.now()

        auth = None
        headers = {}

        if username and password:
            auth = httpx.BasicAuth(username, password)
        elif api_key:
            headers['Authorization'] = f"Bearer {api_key}"

        # Strip trailing slash to avoid double-slash in URL concatenation
        url = url.rstrip('/')

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # Test Prometheus API status endpoint
            response = await client.get(
                f"{url}/api/v1/status/config",
                auth=auth,
                headers=headers
            )

            response_time = int((datetime.now() - start_time).total_seconds() * 1000)

            if response.status_code == 200:
                data = response.json()
                return TestConnectionResponse(
                    success=True,
                    message="Successfully connected to Prometheus",
                    details={
                        "version": data.get("data", {}).get("yaml", "").split("\n")[0] if data.get("status") == "success" else "Unknown",
                        "status": data.get("status")
                    },
                    response_time_ms=response_time
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Failed to connect: HTTP {response.status_code}",
                    details={"status_code": response.status_code},
                    response_time_ms=response_time
                )

    except httpx.TimeoutException:
        return TestConnectionResponse(
            success=False,
            message="Connection timeout - Prometheus not responding",
            details={"error": "timeout"}
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection failed: {str(e)}",
            details={"error": str(e)}
        )


async def test_grafana_connection(url: str, username: str = None, password: str = None, api_key: str = None) -> TestConnectionResponse:
    """Test Grafana connection"""
    try:
        start_time = datetime.now()

        auth = None
        headers = {}

        if api_key:
            headers['Authorization'] = f"Bearer {api_key}"
        elif username and password:
            auth = httpx.BasicAuth(username, password)

        # Strip trailing slash to avoid double-slash in URL concatenation
        url = url.rstrip('/')

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # Test Grafana API health endpoint
            response = await client.get(
                f"{url}/api/health",
                auth=auth,
                headers=headers
            )

            response_time = int((datetime.now() - start_time).total_seconds() * 1000)

            if response.status_code == 200:
                data = response.json()
                return TestConnectionResponse(
                    success=True,
                    message="Successfully connected to Grafana",
                    details={
                        "version": data.get("version", "Unknown"),
                        "database": data.get("database", "Unknown")
                    },
                    response_time_ms=response_time
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Failed to connect: HTTP {response.status_code}",
                    details={"status_code": response.status_code},
                    response_time_ms=response_time
                )

    except httpx.TimeoutException:
        return TestConnectionResponse(
            success=False,
            message="Connection timeout - Grafana not responding",
            details={"error": "timeout"}
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection failed: {str(e)}",
            details={"error": str(e)}
        )


async def test_alertmanager_connection(url: str, username: str = None, password: str = None, api_key: str = None) -> TestConnectionResponse:
    """Test AlertManager connection"""
    try:
        start_time = datetime.now()

        auth = None
        headers = {}

        if username and password:
            auth = httpx.BasicAuth(username, password)
        elif api_key:
            headers['Authorization'] = f"Bearer {api_key}"

        # Strip trailing slash to avoid double-slash in URL concatenation
        url = url.rstrip('/')

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # Test AlertManager API status endpoint
            response = await client.get(
                f"{url}/api/v2/status",
                auth=auth,
                headers=headers
            )

            response_time = int((datetime.now() - start_time).total_seconds() * 1000)

            if response.status_code == 200:
                data = response.json()
                return TestConnectionResponse(
                    success=True,
                    message="Successfully connected to AlertManager",
                    details={
                        "version": data.get("versionInfo", {}).get("version", "Unknown"),
                        "cluster": data.get("cluster", {}).get("status", "Unknown")
                    },
                    response_time_ms=response_time
                )
            else:
                return TestConnectionResponse(
                    success=False,
                    message=f"Failed to connect: HTTP {response.status_code}",
                    details={"status_code": response.status_code},
                    response_time_ms=response_time
                )

    except httpx.TimeoutException:
        return TestConnectionResponse(
            success=False,
            message="Connection timeout - AlertManager not responding",
            details={"error": "timeout"}
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection failed: {str(e)}",
            details={"error": str(e)}
        )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/projects/{project_id}/monitoring/integrations")
async def list_monitoring_integrations(
    project_id: str,
    integration_type: Optional[str] = None,
    user=Depends(get_current_user)
):
    """
    List all monitoring integrations for a project

    Optionally filter by integration_type (prometheus, grafana, alertmanager)
    """
    @sync_to_async
    def get_integrations():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if user is member
        is_member = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub']
        ).exists()
        if not is_member:
            raise HTTPException(status_code=403, detail="Access denied to this project")

        # Get integrations
        filters = {'project_id': project_id}
        if integration_type:
            filters['integration_type'] = integration_type

        integrations = MonitoringIntegration.objects.filter(**filters)
        return [integration.to_dict() for integration in integrations]

    return await get_integrations()


@router.post("/projects/{project_id}/monitoring/integrations", response_model=MonitoringIntegrationResponse)
async def create_monitoring_integration(
    project_id: str,
    data: MonitoringIntegrationCreate,
    user=Depends(get_current_user)
):
    """
    Create a new monitoring integration for a project

    Automatically sets is_primary=True if this is the first integration of this type.
    Generates webhook secret automatically if webhook_enabled=True.
    """
    @sync_to_async
    def create_integration():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if user is owner
        is_owner = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub'],
            role=ProjectRole.OWNER
        ).exists()
        if not is_owner:
            raise HTTPException(status_code=403, detail="Only project owner can create integrations")

        # Check if integration type is valid
        valid_types = ['prometheus', 'grafana', 'alertmanager']
        if data.integration_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid integration_type. Must be one of: {', '.join(valid_types)}"
            )

        # Check if this is the first integration of this type
        existing_count = MonitoringIntegration.objects.filter(
            project_id=project_id,
            integration_type=data.integration_type
        ).count()

        # If user wants to set is_primary=True, check if another primary exists
        if data.is_primary:
            existing_primary = MonitoringIntegration.objects.filter(
                project_id=project_id,
                integration_type=data.integration_type,
                is_primary=True
            ).first()

            if existing_primary:
                # Unset the existing primary
                existing_primary.is_primary = False
                existing_primary.save()

        # Create integration (normalize URL by stripping trailing slash)
        integration = MonitoringIntegration.objects.create(
            project=project,
            integration_type=data.integration_type,
            name=data.name,
            description=data.description,
            url=str(data.url).rstrip('/'),
            username=data.username,
            config=data.config or {},
            webhook_enabled=data.webhook_enabled,
            is_primary=data.is_primary if existing_count > 0 else True,  # First one is always primary
            status='inactive',  # Start as inactive until tested
            created_by_id=user['sub']
        )

        # Encrypt and set password/API key if provided
        if data.password:
            integration.set_password(data.password)
        if data.api_key:
            integration.set_api_key(data.api_key)

        # Generate webhook secret if webhook enabled
        if data.webhook_enabled:
            integration.generate_webhook_secret()

        integration.save()

        return integration.to_dict()

    return await create_integration()


@router.get("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def get_monitoring_integration(
    project_id: str,
    integration_id: str,
    include_secrets: bool = False,
    user=Depends(get_current_user)
):
    """
    Get details of a specific monitoring integration

    Set include_secrets=true to include decrypted passwords and API keys (requires owner permission)
    """
    @sync_to_async
    def get_integration():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if user is member
        is_member = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub']
        ).exists()
        if not is_member:
            raise HTTPException(status_code=403, detail="Access denied to this project")

        # Get integration
        integration = MonitoringIntegration.objects.filter(
            id=integration_id,
            project_id=project_id
        ).first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Only owner can view secrets
        if include_secrets:
            is_owner = ProjectMember.objects.filter(
                project_id=project_id,
                user_id=user['sub'],
                role=ProjectRole.OWNER
            ).exists()
            if not is_owner:
                raise HTTPException(status_code=403, detail="Only project owner can view secrets")

        return integration.to_dict(include_secrets=include_secrets)

    return await get_integration()


@router.patch("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def update_monitoring_integration(
    project_id: str,
    integration_id: str,
    data: MonitoringIntegrationUpdate,
    user=Depends(get_current_user)
):
    """
    Update a monitoring integration

    Can update name, description, URL, credentials, config, webhook settings, and status
    """
    @sync_to_async
    def update_integration():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Only owner can update integrations
        is_owner = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub'],
            role=ProjectRole.OWNER
        ).exists()
        if not is_owner:
            raise HTTPException(status_code=403, detail="Only project owner can update integrations")

        # Get integration
        integration = MonitoringIntegration.objects.filter(
            id=integration_id,
            project_id=project_id
        ).first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Update fields
        if data.name is not None:
            integration.name = data.name
        if data.description is not None:
            integration.description = data.description
        if data.url is not None:
            integration.url = str(data.url).rstrip('/')
        if data.username is not None:
            integration.username = data.username
        if data.password is not None:
            integration.set_password(data.password)
        if data.api_key is not None:
            integration.set_api_key(data.api_key)
        if data.config is not None:
            integration.config = data.config
        if data.webhook_enabled is not None:
            integration.webhook_enabled = data.webhook_enabled
            if data.webhook_enabled and not integration.webhook_secret:
                integration.generate_webhook_secret()
        if data.status is not None:
            integration.status = data.status
        if data.is_primary is not None:
            # If setting as primary, unset other primaries
            if data.is_primary:
                MonitoringIntegration.objects.filter(
                    project_id=project_id,
                    integration_type=integration.integration_type,
                    is_primary=True
                ).exclude(id=integration_id).update(is_primary=False)

            integration.is_primary = data.is_primary

        integration.save()

        return integration.to_dict()

    return await update_integration()


@router.delete("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def delete_monitoring_integration(
    project_id: str,
    integration_id: str,
    user=Depends(get_current_user)
):
    """
    Delete a monitoring integration

    This will also delete all associated alerts
    """
    @sync_to_async
    def delete_integration():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Only owner can delete integrations
        is_owner = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub'],
            role=ProjectRole.OWNER
        ).exists()
        if not is_owner:
            raise HTTPException(status_code=403, detail="Only project owner can delete integrations")

        # Get integration
        integration = MonitoringIntegration.objects.filter(
            id=integration_id,
            project_id=project_id
        ).first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        # Delete integration (cascade will delete alerts)
        integration.delete()

        return {"message": "Integration deleted successfully"}

    return await delete_integration()


@router.post("/projects/{project_id}/monitoring/integrations/test-connection", response_model=TestConnectionResponse)
async def test_monitoring_connection(
    project_id: str,
    data: TestConnectionRequest,
    user=Depends(get_current_user)
):
    """
    Test connection to a monitoring service without creating an integration

    Useful for validating credentials before saving
    """
    # Verify user has access to this project
    project = await get_user_project(user['sub'], project_id)
    if not project:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    # Test connection based on integration type
    if data.integration_type == 'prometheus':
        return await test_prometheus_connection(str(data.url), data.username, data.password, data.api_key)
    elif data.integration_type == 'grafana':
        return await test_grafana_connection(str(data.url), data.username, data.password, data.api_key)
    elif data.integration_type == 'alertmanager':
        return await test_alertmanager_connection(str(data.url), data.username, data.password, data.api_key)
    else:
        raise HTTPException(status_code=400, detail=f"Invalid integration_type: {data.integration_type}")


@router.post("/projects/{project_id}/monitoring/integrations/{integration_id}/test")
async def test_existing_integration(
    project_id: str,
    integration_id: str,
    user=Depends(get_current_user)
):
    """
    Test connection for an existing monitoring integration

    Updates last_test_at, last_test_success, and last_error_message fields
    """
    @sync_to_async
    def get_integration():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if user is member
        is_member = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub']
        ).exists()
        if not is_member:
            raise HTTPException(status_code=403, detail="Access denied to this project")

        # Get integration
        integration = MonitoringIntegration.objects.filter(
            id=integration_id,
            project_id=project_id
        ).first()

        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        return integration

    integration = await get_integration()

    # Test connection
    if integration.integration_type == 'prometheus':
        result = await test_prometheus_connection(
            integration.url,
            integration.username,
            integration.get_password(),
            integration.get_api_key()
        )
    elif integration.integration_type == 'grafana':
        result = await test_grafana_connection(
            integration.url,
            integration.username,
            integration.get_password(),
            integration.get_api_key()
        )
    elif integration.integration_type == 'alertmanager':
        result = await test_alertmanager_connection(
            integration.url,
            integration.username,
            integration.get_password(),
            integration.get_api_key()
        )
    else:
        raise HTTPException(status_code=400, detail=f"Invalid integration_type: {integration.integration_type}")

    # Update integration with test results
    @sync_to_async
    def update_test_results():
        integration.last_test_at = datetime.now()
        integration.last_test_success = result.success

        if result.success:
            integration.status = 'active'
            integration.last_error_message = None
        else:
            integration.status = 'error'
            integration.last_error_message = result.message

        integration.save()

    await update_test_results()

    return result


@router.get("/projects/{project_id}/monitoring/alerts")
async def list_monitoring_alerts(
    project_id: str,
    integration_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user)
):
    """
    List alerts received from monitoring integrations

    Optionally filter by integration_id and status
    """
    @sync_to_async
    def get_alerts():
        # Verify user has access to this project
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if user is member
        is_member = ProjectMember.objects.filter(
            project_id=project_id,
            user_id=user['sub']
        ).exists()
        if not is_member:
            raise HTTPException(status_code=403, detail="Access denied to this project")

        # Build query
        query = MonitoringAlert.objects.filter(integration__project_id=project_id)

        if integration_id:
            query = query.filter(integration_id=integration_id)
        if status:
            query = query.filter(status=status)

        # Get alerts
        alerts = query.order_by('-received_at')[:limit]
        return [alert.to_dict() for alert in alerts]

    return await get_alerts()
