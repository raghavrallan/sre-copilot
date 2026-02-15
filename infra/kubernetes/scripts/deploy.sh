#!/bin/bash
set -euo pipefail

# Deploy SRE-Copilot to local Kubernetes cluster
# Usage: bash infra/kubernetes/scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$SCRIPT_DIR/../overlays/local"

echo "=== Deploying SRE-Copilot to Kubernetes ==="

# Apply Kustomize manifests
echo "--- Applying manifests ---"
kubectl apply -k "$OVERLAY_DIR"

# Wait for Redis first
echo "--- Waiting for Redis ---"
kubectl -n sre-copilot rollout status statefulset/redis --timeout=120s

# Wait for all deployments
echo "--- Waiting for all deployments ---"
DEPLOYMENTS=$(kubectl -n sre-copilot get deployments -o jsonpath='{.items[*].metadata.name}')
for DEPLOY in $DEPLOYMENTS; do
    echo "  Waiting for $DEPLOY..."
    kubectl -n sre-copilot rollout status deployment/$DEPLOY --timeout=180s || echo "  WARNING: $DEPLOY did not become ready"
done

echo ""
echo "--- Pod Status ---"
kubectl -n sre-copilot get pods -o wide

echo ""
echo "--- Service Status ---"
kubectl -n sre-copilot get services

echo ""
echo "=== Deployment Complete ==="
echo "Frontend: http://localhost:30000"
echo "API:      http://localhost:30000/api/v1/health"
