"""
Database utility functions
"""
import os
import django
from django.conf import settings


def setup_django():
    """Initialize Django ORM"""
    if not settings.configured:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
        django.setup()


async def get_db_connection():
    """Get database connection (for async operations)"""
    from django.db import connection
    return connection
