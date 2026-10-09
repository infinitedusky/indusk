# lib/papers — rules for working here

Loaded by Claude Code when a file under `src/lib/papers/` is read. Moved here
from the package `CLAUDE.md` on 2026-10-08 (server-provisioning): it applies
to this folder only.

- **The papers module map**: `lib/papers/summary.ts` owns paper parsing and
  `plan-parser.ts` re-exports its names so the `planning/plan-parser` subpath
  holds; `papers/provenance.ts` owns the `published` block's shapes (pinned by
  key count in `papers/shared-definitions.test.ts`); `lib/git.ts` owns
  `snapshotPaths` / `restorePaths`; `papers/publish.ts` is the procedure only.
  A second `data.published as {…}` narrowing under `src/lib` fails the pin.
  Staleness is derived from `paperContentHash` on every read, never stored;
  an unknown status reads `malformed`, never a silent draft. — see
  `/reference/cli/papers`
