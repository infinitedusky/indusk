# lib/promises — rules for working here

Loaded by Claude Code when a file under `src/lib/promises/` is read. Moved here
from the package `CLAUDE.md` on 2026-10-10 (release-records-its-failures): they
apply to this folder only.

- One registry subpath (`promises/registry`) for CLI, MCP and admin; writes
  only via `lib/promises/write.ts`; marks through `readPromiseMarks` and
  `jaegerEndpoint`; unreachable = exit 2, never zero. `promises.jaeger`
  (`url` + `credential_env`, a variable's *name*) names a server; absence =
  the local daemon. — see `/decisions/day-monitor`
- **An opened incident never takes an id its owner's Maintenance phases name**
  (`maintenanceIncidentIds`); `watch` exits 1 for, and retries every run,
  any incident left without its owner's phase. Evidence: `traces:` or
  `tests:`+`release:` (a release's incident is written by `test-incident.ts`, never imported by `release/`); readers take both. — see `/reference/cli/promises`
- **`recordBreaks` is the one writer, run by the admin unasked; it commits on a trunk only**, after the inbox and heard rows;
  what it could not commit waits in the home's `pending-commit.json`. — see `/decisions/incident-recording`
- **A plan's dates fall back for what older plans never wrote** (`display.ts`):
  an archived plan is landed on its retrospective's `date` (else its impl's),
  and `started` is the first lifecycle document's `date` when there is no brief.
  — see `/reference/cli/promises`
- **`display.ts` reads a plan document's frontmatter through `gray-matter`, never its own pattern** — the plan page and the editor must name one plan one way; a date YAML parses to a `Date` is turned back into `YYYY-MM-DD`. — see `/reference/cli/promises`
