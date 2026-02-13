#!/usr/bin/env bash
set -e
echo "=== Building Synthetic Service ==="
if [ -d "../../shared" ]; then
  cp -r ../../shared ./shared
else
  mkdir -p ./shared/utils
  touch ./shared/__init__.py
  touch ./shared/utils/__init__.py
fi
pip install --upgrade pip
pip install -r requirements.txt
echo "=== Synthetic Service build complete ==="
