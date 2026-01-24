"""
Project management endpoints
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from django.utils import timezone
import uuid

from shared.models.tenant import User
from shared.models.project import Project, ProjectMember, ProjectRole
from app.core.security import verify_token

router = APIRouter()


class CreateProjectRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    timezone: str = "UTC"


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    slug: str
    description: str
    timezone: str
    is_active: bool
    created_at: str
    updated_at: str
    member_count: int
    current_user_role: str

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_email: str
    role: str = ProjectRole.ENGINEER


class UpdateMemberRequest(BaseModel):
    role: str


class MemberResponse(BaseModel):
    user_id: str
    user_email: str
    user_name: str
    role: str
    joined_at: str

    class Config:
        from_attributes = True


async def get_current_user_from_token(authorization: Optional[str] = Header(None)):
    """Extract and verify user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    parts = authorization.split()
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = parts[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user = await User.objects.select_related('tenant').aget(id=payload["sub"])
        return user, payload
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found")


@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(authorization: Optional[str] = Header(None)):
    """List all projects for the current user"""
    user, payload = await get_current_user_from_token(authorization)

    projects = []
    async for membership in ProjectMember.objects.filter(user=user).select_related('project'):
        project = membership.project

        # Count members
        member_count = await ProjectMember.objects.filter(project=project).acount()

        projects.append(ProjectResponse(
            id=str(project.id),
            tenant_id=str(project.tenant_id),
            name=project.name,
            slug=project.slug,
            description=project.description,
            timezone=project.timezone,
            is_active=project.is_active,
            created_at=project.created_at.isoformat(),
            updated_at=project.updated_at.isoformat(),
            member_count=member_count,
            current_user_role=membership.role
        ))

    return projects


@router.post("/projects", response_model=ProjectResponse)
async def create_project(
    request: CreateProjectRequest,
    authorization: Optional[str] = Header(None)
):
    """Create a new project"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if slug is unique within tenant
    if await Project.objects.filter(tenant=user.tenant, slug=request.slug).aexists():
        raise HTTPException(status_code=400, detail="Project slug already exists")

    # Create project
    project = await Project.objects.acreate(
        tenant=user.tenant,
        name=request.name,
        slug=request.slug,
        description=request.description,
        timezone=request.timezone,
        is_active=True
    )

    # Add creator as project owner
    await ProjectMember.objects.acreate(
        project=project,
        user=user,
        role=ProjectRole.OWNER
    )

    return ProjectResponse(
        id=str(project.id),
        tenant_id=str(project.tenant_id),
        name=project.name,
        slug=project.slug,
        description=project.description,
        timezone=project.timezone,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        member_count=1,
        current_user_role=ProjectRole.OWNER
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get a specific project"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has access to this project
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    project = membership.project
    member_count = await ProjectMember.objects.filter(project=project).acount()

    return ProjectResponse(
        id=str(project.id),
        tenant_id=str(project.tenant_id),
        name=project.name,
        slug=project.slug,
        description=project.description,
        timezone=project.timezone,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        member_count=member_count,
        current_user_role=membership.role
    )


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    authorization: Optional[str] = Header(None)
):
    """Update a project (requires owner or admin role)"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has admin access to this project
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    if membership.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can update projects")

    project = membership.project

    # Update fields
    if request.name is not None:
        project.name = request.name
    if request.description is not None:
        project.description = request.description
    if request.timezone is not None:
        project.timezone = request.timezone
    if request.is_active is not None:
        project.is_active = request.is_active

    await project.asave()

    member_count = await ProjectMember.objects.filter(project=project).acount()

    return ProjectResponse(
        id=str(project.id),
        tenant_id=str(project.tenant_id),
        name=project.name,
        slug=project.slug,
        description=project.description,
        timezone=project.timezone,
        is_active=project.is_active,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        member_count=member_count,
        current_user_role=membership.role
    )


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Deactivate a project (requires owner role)"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user is project owner
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    if membership.role != ProjectRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owners can delete projects")

    project = membership.project
    project.is_active = False
    await project.asave()

    return {"status": "success", "message": "Project deactivated"}


@router.get("/projects/{project_id}/members", response_model=List[MemberResponse])
async def list_project_members(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """List all members of a project"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has access to this project
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    # Get all members
    members = []
    async for member in ProjectMember.objects.filter(project_id=project_id).select_related('user'):
        members.append(MemberResponse(
            user_id=str(member.user.id),
            user_email=member.user.email,
            user_name=member.user.full_name,
            role=member.role,
            joined_at=member.created_at.isoformat()
        ))

    return members


@router.post("/projects/{project_id}/members", response_model=MemberResponse)
async def add_project_member(
    project_id: str,
    request: AddMemberRequest,
    authorization: Optional[str] = Header(None)
):
    """Add a member to a project (requires owner or admin role)"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has admin access
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    if membership.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can add members")

    project = membership.project

    # Find user by email in the same tenant
    try:
        new_user = await User.objects.aget(email=request.user_email, tenant=project.tenant)
    except User.DoesNotExist:
        raise HTTPException(status_code=404, detail="User not found in this tenant")

    # Check if user is already a member
    if await ProjectMember.objects.filter(project=project, user=new_user).aexists():
        raise HTTPException(status_code=400, detail="User is already a member")

    # Add member
    new_member = await ProjectMember.objects.acreate(
        project=project,
        user=new_user,
        role=request.role
    )

    return MemberResponse(
        user_id=str(new_user.id),
        user_email=new_user.email,
        user_name=new_user.full_name,
        role=new_member.role,
        joined_at=new_member.created_at.isoformat()
    )


@router.patch("/projects/{project_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    project_id: str,
    user_id: str,
    request: UpdateMemberRequest,
    authorization: Optional[str] = Header(None)
):
    """Update a member's role (requires owner or admin role)"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has admin access
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    if membership.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can update member roles")

    # Get target member
    try:
        target_member = await ProjectMember.objects.select_related('user').aget(
            project_id=project_id,
            user_id=user_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=404, detail="Member not found")

    # Prevent changing owner role
    if target_member.role == ProjectRole.OWNER:
        raise HTTPException(status_code=403, detail="Cannot change owner role")

    # Update role
    target_member.role = request.role
    await target_member.asave()

    return MemberResponse(
        user_id=str(target_member.user.id),
        user_email=target_member.user.email,
        user_name=target_member.user.full_name,
        role=target_member.role,
        joined_at=target_member.created_at.isoformat()
    )


@router.delete("/projects/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: str,
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Remove a member from a project (requires owner or admin role)"""
    user, payload = await get_current_user_from_token(authorization)

    # Check if user has admin access
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user=user,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    if membership.role not in [ProjectRole.OWNER, ProjectRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    # Get target member
    try:
        target_member = await ProjectMember.objects.aget(
            project_id=project_id,
            user_id=user_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=404, detail="Member not found")

    # Prevent removing owner
    if target_member.role == ProjectRole.OWNER:
        raise HTTPException(status_code=403, detail="Cannot remove project owner")

    # Remove member
    await target_member.adelete()

    return {"status": "success", "message": "Member removed"}
