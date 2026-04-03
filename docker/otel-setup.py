"""
OpenTelemetry auto-setup for indusk-infra container.
Imported before Graphiti starts. Configures tracing + logging exporters
when OTEL_EXPORTER_OTLP_ENDPOINT is set. No-op when unset.

Usage: python -c "import otel_setup" before starting main.py
  or:  PYTHONPATH=/opt/indusk python -c "import otel_setup; otel_setup.configure()"
"""

import os
import logging

logger = logging.getLogger("indusk-infra.otel")


def configure():
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return None

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource

        from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
        from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter

        service_name = os.environ.get("OTEL_SERVICE_NAME", "indusk-infra")

        resource = Resource.create({"service.name": service_name})

        # Traces
        trace_provider = TracerProvider(resource=resource)
        trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(trace_provider)

        # Logs
        log_provider = LoggerProvider(resource=resource)
        log_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
        handler = LoggingHandler(level=logging.INFO, logger_provider=log_provider)
        logging.getLogger().addHandler(handler)

        tracer = trace.get_tracer("indusk-infra")
        logger.info("OpenTelemetry enabled: traces + logs → %s", endpoint)
        return tracer

    except Exception as e:
        logger.warning("Failed to set up OpenTelemetry: %s", e)
        return None


# Auto-configure on import
_tracer = configure()


def get_tracer():
    return _tracer
