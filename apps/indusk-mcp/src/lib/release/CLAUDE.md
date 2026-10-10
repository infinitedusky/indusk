# lib/release — rules for working here

Loaded by Claude Code when a file under `src/lib/release/` is read
(release-records-its-failures, 2026-10-10).

- **`runRelease` takes its commands, clock and reads as inputs**; the order
  (slow tests `before` or `after`) and what "done" means (`done_when`) are
  declared facts in `workflow.steps.release`, never logic. — see
  `/decisions/release-records-its-failures`
- **Failures come from the declared JUnit report, never the runner's output**
  (`junit.ts`); one rerun by file when `rerun` is declared; more than half the
  files failing is the environment, and opens nothing. — see `/decisions/dawn-verify`
- **A failing file routes through the trajectory rows that name it**
  (`route.ts`): a row's promise gets a test-born incident (`source: release`,
  `tests:` + `release:`), committed on the trunk and put in the break inbox like
  the recorder's; anything else is a draft bugfix plan `fix-<stem>` on its own
  branch, reused while open — never a brief written on the trunk.
