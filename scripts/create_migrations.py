#!/usr/bin/env python
"""
Script to create Django migrations
Run from project root
"""
import os
import sys

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
import django
django.setup()

# Create migrations
from django.core.management import call_command

print("🔄 Creating migrations...")
call_command('makemigrations', 'shared', verbosity=2)
print("✅ Migrations created!")
