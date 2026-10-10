# lib/release — rules for working here

Loaded by Claude Code when a file under `src/lib/release/` is read
(release-records-its-failures, 2026-10-10).

- **`runRelease` takes its commands, clock and reads as inputs**; the order
  (slow tests `before` or `after`) and what "done" means (`done_when`) are
  declared facts in `workflow.steps.release`, never logic. — see
  `/decisions/release-records-its-failures`
- **Failures come from the declared JUnit report, never the runner's output**
  (`junit.ts`); one rerun by file when `rerun` is declared; more than half the
  files failing is the environment, and opens nothing. **A flake is a file the
  rerun's report shows passing, never one it leaves out** (`junit.ts` `passed`). — see `/decisions/dawn-verify`
- **A failing file routes through the trajectory rows that name it**
  (`route.ts` — routing; `settle.ts` — settling): a row's promise gets a test-born incident (`source: release`,
  `tests:` + `release:`), committed on the trunk and put in the break inbox like
  the recorder's; anything else is a draft bugfix plan `fix-<stem>` on its own
  branch, reused while open — never a brief written on the trunk.
- **A report older than the slow run is not this run's, and is never read**
  (`failedFiles(…, since)`; never deleted, a broad glob would reach a project's
  own files). **A file name reaches a shell only single-quoted.** **Routing
  never loses the release:** a throw is `no failure routed: …` on stderr and
  `routing` on the record. **A bugfix plan's name never collides with an open
  plan for another file, an archived one, a trunk folder or a `plan/<name>` branch** (`bugfix-plan.ts`).
