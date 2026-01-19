"""
Shared Django settings for all microservices
"""
import os
from pathlib import Path

# Django settings
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'shared.apps.SharedConfig',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'sre_copilot'),
        'USER': os.getenv('POSTGRES_USER', 'sre_user'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'sre_password'),
        'HOST': os.getenv('POSTGRES_HOST', 'postgres'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'ATOMIC_REQUESTS': True,
        'CONN_MAX_AGE': 600,
    }
}

# Timezone
USE_TZ = True
TIME_ZONE = 'UTC'

# Secret key (override in production)
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-in-production')

# Debug mode
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

# Allowed hosts
ALLOWED_HOSTS = ['*']  # Restrict in production

# Default auto field
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
