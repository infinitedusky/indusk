"""
OpenTelemetry Auto-Instrumentation for Python

Run your application with the auto-instrumentation wrapper:

    opentelemetry-instrument python your_app.py

Or import this module before your application code:

    import instrumentation  # noqa: F401
    from your_app import main
    main()

Where spans go, the service name and the resource are decided below (RENDERED and
the lines after it): with nothing set, the local InDusk daemon (`indusk telemetry address`).

Configuration via environment variables (each wins over the rendered values):
    OTEL_SERVICE_NAME              — service name
    OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP collector URL
    OTEL_RESOURCE_ATTRIBUTES      — e.g. "deployment.environment=production"
    OTEL_EXPORTER_OTLP_HEADERS    — auth headers (e.g., "Authorization=Bearer xxx")
    OTEL_PYTHON_LOG_CORRELATION   — set to "true" for trace context in logs (default)

Install required packages:
    pip install opentelemetry-distro opentelemetry-instrumentation opentelemetry-exporter-otlp

Then auto-install all available instrumentations:
    opentelemetry-bootstrap --action=install
"""

import os
import sys
import logging

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME

# Telemetry settings: the same decisions as telemetry-settings.ts in a Node app.
# Replaced whole by the scaffold; one line, so a render is one substitution.
RENDERED = {"service": "", "project": "", "traces": "", "logs": ""}


def _endpoint(own, rendered, path):
    """The signal's own endpoint as given, else the general one or the rendered address with the path."""
    given = os.environ.get(own)
    if given:
        return given
    base = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or rendered
    return base.rstrip("/") + path


def _resource_attribute(key):
    """One key of OTEL_RESOURCE_ATTRIBUTES (k=v,k2=v2), or None when it is not set there."""
    for pair in os.environ.get("OTEL_RESOURCE_ATTRIBUTES", "").split(","):
        name, eq, value = pair.partition("=")
        if eq and name.strip() == key:
            return value.strip()
    return None


SERVICE = os.environ.get("OTEL_SERVICE_NAME") or RENDERED["service"]
TRACES_URL = _endpoint("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", RENDERED["traces"], "/v1/traces")
LOGS_URL = _endpoint("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT", RENDERED["logs"], "/v1/logs")
# A run under pytest is marked on the resource, so what reads these spans can tell a test's from a user's.
TEST_RUN = "pytest" in sys.modules or bool(os.environ.get("PYTEST_VERSION"))
RESOURCE_ATTRIBUTES = {
    SERVICE_NAME: SERVICE,
    "indusk.project": RENDERED["project"],
    "deployment.environment": _resource_attribute("deployment.environment") or "development",
}
if TEST_RUN:
    RESOURCE_ATTRIBUTES["indusk.run"] = "test"

provider = TracerProvider(resource=Resource.create(RESOURCE_ATTRIBUTES))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=TRACES_URL)))

trace.set_tracer_provider(provider)

# Enable trace context correlation in Python logging
os.environ.setdefault("OTEL_PYTHON_LOG_CORRELATION", "true")

# Configure structured logging
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] [trace_id=%(otelTraceID)s span_id=%(otelSpanID)s] %(message)s",
)
