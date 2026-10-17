# lib/scaffold — rules for working here

Loaded by Claude Code when a file under `src/lib/scaffold/` is read
(a-new-project-starts-instrumented, 2026-10-17).

- **A template reaches a project only through this module** (render, record,
  apply); `init` and `update` call `applyScaffold`, and neither copies or
  rewrites a template inline. The record is `.indusk/scaffold.json`. — see
  `/decisions/init-sets-up-telemetry`
- **Decisions are made in `plan.ts` from what was read**; `apply.ts` reads and
  writes and decides nothing. Only a file whose hash matches the record is
  written over; an edited or unrecorded one keeps its content and gets
  `<file>.indusk-new` beside it (T10 in `plan.test.ts`).
- **A render replaces only the RENDERED line** of `telemetry-settings.ts` and
  `instrumentation.py`; a template without one is copied as it is. No port
  number appears here: `settingsValues` takes the stored address, else
  `PORT_BLOCK`.
