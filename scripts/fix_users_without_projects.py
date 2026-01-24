#!/usr/bin/env python
"""
Script to fix users without projects by creating default projects
Run from project root: python scripts/fix_users_without_projects.py
"""
import os
import sys

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
import django
django.setup()

from shared.models.tenant import User
from shared.models.project import Project, ProjectMember, ProjectRole
import asyncio


async def fix_users_without_projects():
    """Create default projects for users who don't have any"""
    print("🔍 Finding users without projects...")

    users_fixed = 0
    users_skipped = 0

    async for user in User.objects.select_related('tenant').all():
        # Check if user has any project memberships
        has_projects = await ProjectMember.objects.filter(user=user).aexists()

        if not has_projects:
            print(f"\n👤 User: {user.email} (Tenant: {user.tenant.name})")
            print(f"   Creating default project...")

            # Create default project
            project = await Project.objects.acreate(
                tenant=user.tenant,
                name="Default Project",
                slug="default",
                description="Your default project",
                is_active=True
            )

            # Add user as project owner
            await ProjectMember.objects.acreate(
                project=project,
                user=user,
                role=ProjectRole.OWNER
            )

            print(f"   ✅ Created project: {project.name} (ID: {project.id})")
            print(f"   ✅ Added user as OWNER")
            users_fixed += 1
        else:
            users_skipped += 1

    print(f"\n" + "="*50)
    print(f"✅ Fixed {users_fixed} user(s)")
    print(f"⏭️  Skipped {users_skipped} user(s) (already have projects)")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(fix_users_without_projects())
