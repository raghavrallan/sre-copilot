#!/bin/bash
set -euo pipefail

# Build all SRE-Copilot Docker images for Kubernetes deployment
# Run from repo root: bash infra/kubernetes/scripts/build-images.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DOCKER_DIR="$SCRIPT_DIR/../docker"

echo "=== Building SRE-Copilot K8s Images ==="
echo "Repo root: $REPO_ROOT"
echo ""

# Backend services: name -> port
declare -A SERVICES=(
    ["api-gateway"]=8500
    ["auth-service"]=8501
    ["incident-service"]=8502
    ["ai-service"]=8503
    ["integration-service"]=8504
    ["websocket-service"]=8505
    ["audit-service"]=8508
    ["metrics-collector-service"]=8509
    ["log-service"]=8510
    ["alerting-service"]=8511
    ["synthetic-service"]=8512
    ["security-service"]=8513
    ["cloud-connector-service"]=8514
    ["cicd-connector-service"]=8515
)

FAILED=()

# Build backend services
for SERVICE in "${!SERVICES[@]}"; do
    PORT=${SERVICES[$SERVICE]}
    IMAGE="sre-copilot/${SERVICE}:latest"
    echo "--- Building $IMAGE (port $PORT) ---"
    if docker build \
        -f "$DOCKER_DIR/Dockerfile.service" \
        --build-arg SERVICE_NAME="$SERVICE" \
        --build-arg SERVICE_PORT="$PORT" \
        -t "$IMAGE" \
        "$REPO_ROOT"; then
        echo "  OK: $IMAGE"
    else
        echo "  FAILED: $IMAGE"
        FAILED+=("$SERVICE")
    fi
    echo ""
done

# Build frontend
echo "--- Building sre-copilot/frontend:latest ---"
VITE_API_GATEWAY_URL="${VITE_API_GATEWAY_URL:-http://localhost:30000}"
VITE_WEBSOCKET_URL="${VITE_WEBSOCKET_URL:-ws://localhost:30000}"
if docker build \
    -f "$DOCKER_DIR/Dockerfile.frontend" \
    --build-arg VITE_API_GATEWAY_URL="$VITE_API_GATEWAY_URL" \
    --build-arg VITE_WEBSOCKET_URL="$VITE_WEBSOCKET_URL" \
    -t "sre-copilot/frontend:latest" \
    "$REPO_ROOT"; then
    echo "  OK: sre-copilot/frontend:latest"
else
    echo "  FAILED: sre-copilot/frontend:latest"
    FAILED+=("frontend")
fi

echo ""
echo "=== Build Summary ==="
echo "Total: $((${#SERVICES[@]} + 1)) images"
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "All images built successfully!"
else
    echo "Failed (${#FAILED[@]}): ${FAILED[*]}"
    exit 1
fi
