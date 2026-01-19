#!/usr/bin/env python
"""
Django database migration script
Run this to create database tables
"""
import os
import sys
import django
from django.core.management import call_command

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
django.setup()

def main():
    print("🔄 Running database migrations...")

    # Make migrations
    print("\n1. Creating migrations...")
    call_command('makemigrations')

    # Apply migrations
    print("\n2. Applying migrations...")
    call_command('migrate')

    print("\n✅ Database migrations completed successfully!")

if __name__ == '__main__':
    main()
