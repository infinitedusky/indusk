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
- **A file InDusk recorded and a person deleted stays deleted**: `decideFile` says
  `removed`, `apply.ts` prints one `left out:` line and keeps the record; `init
  --force` writes it back (T29 in `plan.test.ts` and `update-scaffold-refresh.test.ts`).
- **The Next.js setup file goes where the pages are**: `src/instrumentation.ts` when
  `src/app` or `src/pages` exists, else the root; Next.js loads it from nowhere else
  (T25 in `init-scaffold-placement.test.ts`).
- **The record holds `fingerprint(text)`, not a hash of the exact text**: it ignores
  whitespace, `;`, trailing commas and quote style, so a formatter's re-layout never makes
  a file look edited; older exact-hash records still match (T30 in `plan.test.ts`).
