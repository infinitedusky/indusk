#!/bin/bash
set -e

# Start FalkorDB using its native run script (Redis + FalkorDB module)
/var/lib/falkordb/bin/run.sh &
REDIS_PID=$!

# Wait for FalkorDB to be ready — poll until it responds
echo "[indusk-infra] Waiting for FalkorDB to be ready..."
until redis-cli ping 2>/dev/null | grep -q PONG; do
    sleep 1
done
echo "[indusk-infra] FalkorDB is ready."

# Start Graphiti MCP server
# OTel env vars are set in Dockerfile (protocol, exporters, service name)
# If OTEL_EXPORTER_OTLP_ENDPOINT is set at runtime, auto-instrumentation activates
echo "[indusk-infra] Starting Graphiti MCP server..."
cd /opt/graphiti
if [ -n "$OTEL_EXPORTER_OTLP_ENDPOINT" ]; then
    uv run opentelemetry-instrument mcp_server/main.py &
else
    uv run mcp_server/main.py &
fi
GRAPHITI_PID=$!

# Wait for Graphiti to be ready — poll until health endpoint responds
echo "[indusk-infra] Waiting for Graphiti to be ready..."
until curl -sf http://localhost:8100/health > /dev/null 2>&1; do
    # Check if the process died
    if ! kill -0 $GRAPHITI_PID 2>/dev/null; then
        echo "[indusk-infra] Graphiti failed to start. Restarting in 5s..."
        sleep 5
        cd /opt/graphiti
        if [ -n "$OTEL_EXPORTER_OTLP_ENDPOINT" ]; then
            uv run opentelemetry-instrument mcp_server/main.py &
        else
            uv run mcp_server/main.py &
        fi
        GRAPHITI_PID=$!
    fi
    sleep 2
done
echo "[indusk-infra] Graphiti is ready."

# Report OTel status
if [ -n "$OTEL_EXPORTER_OTLP_ENDPOINT" ]; then
    echo "[indusk-infra] OTel export enabled → $OTEL_EXPORTER_OTLP_ENDPOINT"
else
    echo "[indusk-infra] OTel export disabled (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)"
fi

echo "[indusk-infra] All services running. FalkorDB:6379 Graphiti:8100"

# Trap signals for clean shutdown
trap "kill $REDIS_PID $GRAPHITI_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for either process to exit
wait -n $REDIS_PID $GRAPHITI_PID
EXIT_CODE=$?

echo "[indusk-infra] A process exited with code $EXIT_CODE. Shutting down."
kill $REDIS_PID $GRAPHITI_PID 2>/dev/null
exit $EXIT_CODE
