"""
Signal helper: how this app tells InDusk whether a promise held.

One call per verdict, from the place the behaviour happens:

    from indusk_signal import signal

    signal.upheld("a-hold-is-released", clause="on-time", value=812, bound=1000)
    signal.broken("a-hold-is-released", symptom="released 5.1 s late", clause="on-time")

Each call writes one short span through OpenTelemetry's API (`opentelemetry.trace` is
the only import), a child of the active span when there is one. The span is ordinary
OpenTelemetry: it exports wherever your tracer exports, and anyone with the raw trace
can read which promise held and which broke.

This file is yours. `indusk update` refreshes it while you leave it as it is; once you
change it, a newer version is written beside it as `indusk_signal.py.indusk-new`. The
keys it writes are InDusk's vocabulary; a test in InDusk holds them equal, so change none
of them here. (It is written as `indusk_signal.py` because a file named `signal.py` would
hide Python's own `signal` module.)
"""

import os
import sys

from opentelemetry import trace


def _context():
    """The project and test-run marker copied onto every signal's span: readers read the project from the span itself."""
    attributes = {}
    try:
        from instrumentation import RESOURCE_ATTRIBUTES  # the scaffolded setup, when this app has it

        project = RESOURCE_ATTRIBUTES.get("indusk.project")
        if project:
            attributes["indusk.project"] = project
    except ImportError:
        pass
    if "pytest" in sys.modules or os.environ.get("PYTEST_VERSION"):
        attributes["indusk.run"] = "test"
    return attributes


def _write(promise, outcome, symptom=None, clause=None, value=None, bound=None, plan=None, phase=None):
    attributes = {"indusk.promise": promise, "indusk.promise.outcome": outcome, **_context()}
    for key, given in (
        ("indusk.clause", clause),
        ("indusk.signal.value", value),
        ("indusk.signal.bound", bound),
        ("indusk.signal.plan", plan),
        ("indusk.signal.phase", phase),
    ):
        if given is not None:
            attributes[key] = given
    span = trace.get_tracer("indusk-signal").start_span(promise, attributes=attributes)
    if symptom is not None:
        span.add_event("indusk.promise.violated", {"indusk.promise.symptom": symptom})
    span.end()


class signal:
    """The two verdicts."""

    @staticmethod
    def upheld(promise, clause=None, value=None, bound=None, plan=None, phase=None):
        """The promise held in this run of the behaviour."""
        _write(promise, "upheld", None, clause, value, bound, plan, phase)

    @staticmethod
    def broken(promise, symptom, clause=None, value=None, bound=None, plan=None, phase=None):
        """The promise broke; `symptom` is one line saying what was seen."""
        _write(promise, "broken", symptom, clause, value, bound, plan, phase)
