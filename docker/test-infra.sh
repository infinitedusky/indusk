#!/bin/bash
# Smoke test for indusk-infra container
# Usage: ./docker/test-infra.sh [GOOGLE_API_KEY]
#
# Tests: build, start, FalkorDB health, Graphiti health, persistence, graceful degradation
# Pass GOOGLE_API_KEY as arg or set in environment for full test (Graphiti + FalkorDB)
# Without it, only FalkerDB is tested (graceful degradation)

set -e

CONTAINER_NAME="indusk-infra-test"
VOLUME_NAME="indusk-test-data"
IMAGE_NAME="indusk-infra"
API_KEY="${1:-$GOOGLE_API_KEY}"
PASS=0
FAIL=0

cleanup() {
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
}

check() {
    local name="$1"
    local result="$2"
    if [ "$result" -eq 0 ]; then
        echo "  ✓ $name"
        PASS=$((PASS + 1))
    else
        echo "  ✗ $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== indusk-infra smoke test ==="
echo ""

# Clean up any previous test container
cleanup

# 1. Build
echo "[1/6] Building image..."
docker build -f docker/Dockerfile.infra -t "$IMAGE_NAME" . > /dev/null 2>&1
check "Image builds" $?

# 2. Start
echo "[2/6] Starting container..."
DOCKER_ARGS="-d --name $CONTAINER_NAME -p 6379:6379 -p 8100:8100 -v $VOLUME_NAME:/data"
if [ -n "$API_KEY" ]; then
    DOCKER_ARGS="$DOCKER_ARGS -e GOOGLE_API_KEY=$API_KEY"
    echo "  (GOOGLE_API_KEY provided — full test)"
else
    echo "  (No GOOGLE_API_KEY — testing graceful degradation only)"
fi
docker run $DOCKER_ARGS "$IMAGE_NAME" > /dev/null 2>&1
check "Container starts" $?

# 3. Wait for FalkorDB
echo "[3/6] Checking FalkorDB..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if redis-cli -h localhost ping 2>/dev/null | grep -q PONG; then
        break
    fi
    sleep 1
    RETRIES=$((RETRIES - 1))
done
redis-cli -h localhost ping 2>/dev/null | grep -q PONG
check "FalkorDB responds to PING" $?

# 4. Check Graphiti (only if API key provided)
echo "[4/6] Checking Graphiti..."
if [ -n "$API_KEY" ]; then
    RETRIES=30
    while [ $RETRIES -gt 0 ]; do
        if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
            break
        fi
        sleep 2
        RETRIES=$((RETRIES - 1))
    done
    curl -sf http://localhost:8100/health > /dev/null 2>&1
    check "Graphiti health endpoint responds" $?

    # Verify shared graph created
    redis-cli -h localhost GRAPH.LIST 2>/dev/null | grep -q shared
    check "Shared graph exists in FalkorDB" $?
else
    echo "  - Skipped (no API key)"
fi

# 5. Persistence test
echo "[5/6] Testing persistence..."
docker stop "$CONTAINER_NAME" > /dev/null 2>&1
docker start "$CONTAINER_NAME" > /dev/null 2>&1
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if redis-cli -h localhost ping 2>/dev/null | grep -q PONG; then
        break
    fi
    sleep 1
    RETRIES=$((RETRIES - 1))
done
redis-cli -h localhost ping 2>/dev/null | grep -q PONG
check "FalkorDB survives restart" $?

if [ -n "$API_KEY" ]; then
    # Wait for Graphiti to reconnect
    RETRIES=30
    while [ $RETRIES -gt 0 ]; do
        if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
            break
        fi
        sleep 2
        RETRIES=$((RETRIES - 1))
    done
    redis-cli -h localhost GRAPH.LIST 2>/dev/null | grep -q shared
    check "Shared graph persists after restart" $?
fi

# 6. Cleanup
echo "[6/6] Cleaning up..."
cleanup
# Keep volume for now — user can remove with: docker volume rm $VOLUME_NAME
check "Cleanup" $?

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
