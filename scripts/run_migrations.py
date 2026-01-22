#!/usr/bin/env python
"""
Script to run Django migrations
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

# Run migrations
from django.core.management import call_command

print("🔄 Running migrations...")
call_command('migrate', verbosity=2)
print("✅ Migrations applied!")
