---
title: "Admin UI Hosting — Test Plan"
date: 2026-04-19
status: accepted
---

# Admin UI Hosting — Test Plan

## Purpose

Behavioral assertions that, taken together, mean the admin UI is hosted as a single local daemon registered against multiple InDusk projects. Each assertion describes what the user (or an external observer) experiences when they install indusk-mcp on a fresh consumer project, run an `indusk ui` lifecycle command, and navigate the served UI in their browser.

The assertions cover three loosely-coupled surfaces that must all work together for the feature to be usable:

1. **CLI lifecycle**: starting, stopping, and inspecting the daemon
2. **Project registry**: `indusk init` and `indusk update` adding/maintaining entries that the UI reflects
3. **Multi-project UI**: project grid, per-project routing, header switcher, cross-project scorecards, stale-entry failure mode

The ADR that follows is constrained by "what makes all these assertions true?" — particularly variant A3 (pre-built bundle in tarball) is locked in because A1 and A4 each fail at least one of the start-latency or zero-extra-tooling assertions below.

## Behavioral Assertions

### CLI lifecycle

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk ui start` from any directory on a machine with indusk-mcp installed brings up the admin UI in under 3 seconds and prints a localhost URL. | end-to-end script (spawn CLI, time-bound stdout assertion) |
| A2 | After `indusk ui start`, the user can close the terminal and the admin UI remains reachable at the printed URL. | manual smoke (start, close terminal, curl URL from a new terminal) |
| A3 | Running `indusk ui status` after a successful start reports "running", the listening port, and the count of registered projects. | end-to-end script (spawn CLI, parse stdout) |
| A4 | Running `indusk ui start` when the daemon is already running prints "already running" and the existing URL — does not spawn a second daemon. | end-to-end script |
| A5 | Running `indusk ui stop` shuts the daemon down within 3 seconds. Subsequent `indusk ui status` reports "not running". | end-to-end script |
| A6 | Running `indusk ui start` with `--port <n>` listens on `n`. If `n` is taken, the CLI auto-bumps to a free port and prints a warning naming the new port. | end-to-end script (occupy a port first, then start) |
| A7 | Running bare `indusk ui` from anywhere is functionally equivalent to `indusk ui start` (starts if needed, prints URL, opens browser unless `--no-open`). | manual smoke (verify browser opens; CLI test for stdout match) |

### Project registry

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A8 | Running `indusk init` from a fresh project directory adds an entry for that project to the user's project registry. The next `indusk ui status` reports the count incremented by 1. | end-to-end script (mkdir tmp project, init it, status, assert count delta) |
| A9 | Running `indusk update` from a project already in the registry validates the entry without creating a duplicate. The registered name and path remain unchanged; the "last seen" timestamp moves forward. | end-to-end script (init, update, assert single entry) |
| A10 | Running `indusk init` from a project whose basename collides with an existing registered project's name registers the new project under a numerically-suffixed name (e.g., `numero-2`) and prints a warning naming the suffix. | end-to-end script (init two tmp dirs with the same basename) |
| A11 | If a registered project's path is deleted from disk, `indusk ui status` still reports it (the registry isn't auto-pruned), and visiting `/p/{name}/` in the UI shows a "this project needs to be reconfigured" failure page rather than a 500 error. | end-to-end script (init, rm path, hit /p/{name}/ via curl, assert HTTP 200 + failure-page marker) |

### Multi-project UI

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A12 | The homepage at `/` shows one card per registered project with the project's name, last-seen-at, and active-plan count. | end-to-end script (curl /, assert grid markers + per-project name strings) + manual smoke (visual confirmation of card layout) |
| A13 | Clicking a project card on the homepage navigates to that project's `/p/{name}/` page, which renders the same sidebar + plan list shape as the per-project mode in 1.26.0. | end-to-end script (curl /p/{name}/, assert sidebar + plan-list markers) |
| A14 | A header dropdown above the plan list switches between any two registered projects without restarting the daemon. The page reloads to the selected project's `/p/{name}/` route. | manual user test (select dropdown, observe URL change + sidebar repopulates) |
| A15 | The `/scorecards` page lists every scorecard from every registered project's `.indusk/eval/results.log`, labeled with the project name on each card. Sort order is most-recent-first across all projects. | end-to-end script (curl /scorecards, assert markers from at least 2 projects' scorecards present) + manual smoke |
| A16 | Bare `indusk ui` from inside a registered project's directory opens the browser to `/p/{this-project}/` (cwd-aware). From outside any registered project, it opens to `/`. | manual smoke (cd into registered project, run, verify browser URL; cd to /tmp, run, verify browser URL) |

### Bundling + bootstrap

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A17 | A consumer who runs `npm install -g @infinitedusky/indusk-mcp@1.27` (the version this plan ships) and then `indusk ui start` from any project: the daemon starts without the consumer running `pnpm install`, `next build`, or any other secondary tool. The admin app's deps come from the indusk-mcp install. | manual smoke (fresh global install in a clean Node env on a non-dusk machine, or simulated via temp dir + `npm install --prefix`) |
| A18 | The published indusk-mcp tarball contains the pre-built Next.js production output (the `admin/` directory with `.next/` populated). Tarball size is bounded — under 50 MB — so it stays a reasonable download. | end-to-end script (`npm pack`, inspect tarball size + contents) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The daemon survives an OS sleep/wake cycle and remains reachable. | macOS sleep behavior is platform-specific and CI doesn't sleep. | Manual review on first install — documented in the smoke procedure. If the daemon dies on sleep, `indusk ui status` will report so and the user can `indusk ui start` again. Acceptable for v1. |
| U2 | The published tarball works on Windows. | dusk's primary stack is macOS/Linux; no Windows CI today. | Out of scope for v1 — Windows support is a separate plan. Document the limitation in the changelog. |

## Notes

- **Mechanism distribution**: 12 of the 18 assertions are end-to-end scripts (CLI invocations + curl assertions against the running daemon). 4 are manual smokes for human-in-the-loop checks (browser auto-open, cross-project visual confirmation). 2 are unit-test-style assertions on the published tarball. No vitest unit/integration tests called out at this level — those will appear in the impl as supporting structure but aren't load-bearing for the test plan.
- **Behavioral framing check**: every assertion describes what the user experiences, not what an internal function does. Specifically: "the daemon is running" is verified via `indusk ui status` reporting "running" (CLI output, observable), not via "the PID file exists" (internal). "The registry has 2 entries" is verified via `indusk ui status` reporting the count, not via `JSON.parse(readFileSync(...)).projects.length === 2` (internal).
- **A11's load-bearing role**: the failure-page assertion is what proves the registry's "no auto-prune" decision is safe. Without A11 passing, we'd have a class of UX failure where the user sees a stack trace instead of a clear instruction.
- **A17's load-bearing role**: this is the assertion that justifies bundling variant A3. If A17 fails, A1 might fail too (start latency) or the consumer setup gets a hidden `pnpm install` step that violates the brief's "indusk update brings everything" framing. The smoke MUST exercise a fresh-install path; running from the dusk monorepo doesn't count because that path has the workspace dep.
- **Open question for ADR**: A18's tarball size cap (50 MB) is a guess. The actual produced bundle may be smaller or larger. If it's >50 MB, the ADR should either justify the larger size or revisit variant choice (back to A1 or A4). Measurement happens during impl Phase 1.
