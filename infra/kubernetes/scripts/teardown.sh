#!/bin/bash
set -euo pipefail

# Teardown SRE-Copilot from local Kubernetes cluster
# Usage: bash infra/kubernetes/scripts/teardown.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$SCRIPT_DIR/../overlays/local"

echo "=== Tearing down SRE-Copilot from Kubernetes ==="

# Delete all resources
kubectl delete -k "$OVERLAY_DIR" --ignore-not-found

# Delete PVCs (Redis data)
echo "--- Cleaning up PVCs ---"
kubectl -n sre-copilot delete pvc --all --ignore-not-found 2>/dev/null || true

# Delete namespace if empty
echo "--- Removing namespace ---"
kubectl delete namespace sre-copilot --ignore-not-found 2>/dev/null || true

echo ""
echo "=== Teardown Complete ==="
