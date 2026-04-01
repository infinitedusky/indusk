"""
OpenTelemetry Auto-Instrumentation for Python

Run your application with the auto-instrumentation wrapper:

    opentelemetry-instrument python your_app.py

Or import this module before your application code:

    import instrumentation  # noqa: F401
    from your_app import main
    main()

Configuration via environment variables:
    OTEL_SERVICE_NAME              — service name (defaults to "unknown-service")
    OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP backend URL
    OTEL_EXPORTER_OTLP_HEADERS    — auth headers (e.g., "Authorization=Bearer xxx")
    OTEL_PYTHON_LOG_CORRELATION   — set to "true" for trace context in logs (default)

Install required packages:
    pip install opentelemetry-distro opentelemetry-instrumentation opentelemetry-exporter-otlp

Then auto-install all available instrumentations:
    opentelemetry-bootstrap --action=install
"""

import os
import logging

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
)
from opentelemetry.sdk.resources import Resource, SERVICE_NAME

# Configure resource with service name
resource = Resource.create(
    {SERVICE_NAME: os.environ.get("OTEL_SERVICE_NAME", "unknown-service")}
)

provider = TracerProvider(resource=resource)

# Use OTLP exporter if endpoint is configured, otherwise console
otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
if otlp_endpoint:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
        OTLPSpanExporter,
    )

    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
else:
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

trace.set_tracer_provider(provider)

# Enable trace context correlation in Python logging
os.environ.setdefault("OTEL_PYTHON_LOG_CORRELATION", "true")

# Configure structured logging
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] [trace_id=%(otelTraceID)s span_id=%(otelSpanID)s] %(message)s",
)
