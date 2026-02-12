#!/usr/bin/env bash
# Build script for Render deployment
# Copies the shared/ directory into the service root before installing dependencies
set -e

echo "=== Building Integration Service ==="

# Copy shared utilities (Render builds from rootDir, so ../../shared is the monorepo's shared/)
if [ -d "../../shared" ]; then
  echo "Copying shared/ directory..."
  cp -r ../../shared ./shared
else
  echo "Warning: shared/ directory not found at ../../shared"
  mkdir -p ./shared/utils
  touch ./shared/__init__.py
  touch ./shared/utils/__init__.py
fi

# Install Python dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Integration Service build complete ==="
