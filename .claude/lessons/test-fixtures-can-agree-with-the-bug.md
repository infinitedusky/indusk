# A fixture that constructs its input the way the implementation reads it cannot find the bug — build the input the way the world does

Twenty unit assertions passed against a reader that looked in the wrong place, because the fixture put the data where the reader looked.

The case: `deployment.environment` is an OpenTelemetry **resource** attribute. A conventionally instrumented application sets it once on the resource, so it arrives in Jaeger on the *process* tags. The reader looked only at the *span* tags. The OTLP test fixture put it on the span — matching the reader — so every row was green while the feature could not work for any real exporter.

What found it: an end-to-end test that spawned a separate process using the actual OpenTelemetry SDK instead of the project's own fixture. The fixture and the implementation shared an assumption; only an input built by neither could see it.

**The rule:** when a value crosses a protocol boundary you did not design (OTLP, HTTP headers, a webhook payload, an OAuth token layout), at least one test must construct that input with the real client library, not with your own helper. A helper written by the same person who wrote the reader encodes the same belief about where the data lives.

**The tell:** every assertion passes and none of them has ever seen the format a third party actually emits. If you cannot name a test whose input was produced by foreign code, you have not tested the boundary — you have tested your own round trip.

**Cheap version:** after fixing such a bug, teach the fixture to produce the real shape too (here: a `resourceAttributes` option), and move one existing assertion onto that path, so the guard lives in the fast suite rather than only in the slow one.
