# A browser trace context manager (zone.js) loses the click's trace across native async/await — use .then() chains in handlers, and check the handler shape before promising "every request" is traced

zone.js is the only browser context manager for OpenTelemetry, and it does not follow native async/await: a click handler that awaits before it calls fetch runs the fetch outside the click's context, so the request's span is not a child of the click's trace. `.then()` chains keep the context. Bundlers such as Vite target modern syntax and emit native `await` unchanged, so source that reads as a promise chain can still be broken by the build, and source written with `await` is broken from the start.

**Why it matters:** a plan that promises "every request carries the click's trace" is unprovable in the browser unless the handler shape is one the context manager can follow. The failure is silent: the requests still send, they are simply orphaned.

**What to do:** before promising per-click trace propagation, (1) check the handler shape the context manager can follow, (2) write the handlers that must propagate as `.then()` chains or call `context.with` explicitly, (3) test the built output, not the source, and (4) if the build target emits native await, either lower the target for those files or name the limitation in the plan's brief.

**Where it came from:** the browser-telemetry-leftovers plan's retrospective (highlight h-20261011-005, 2026-10-11).
