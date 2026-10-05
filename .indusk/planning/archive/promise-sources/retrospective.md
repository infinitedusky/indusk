---
title: "Promise sources — retrospective"
date: 2026-10-05
---

# Promise sources — retrospective

## What We Set Out to Do

The demo needs one picture: the same promise green in production and red on the
laptop, on one page, while a change is being built. Before this plan a project
read one Jaeger — its daemon, or the server `promises.jaeger` names — and nothing
said which. The brief asked for both sources read side by side by every reader
(`promises status`, `promises watch`, `promise_health`, `/catchup`, the admin),
each source's failure its own, and production alone raising the alarm.

## What Actually Happened

The plan shipped as designed in four build phases. The falsification phase
(Build Phase 5) and the cleanup phase (Build Phase 6) each found real defects,
and both closed. Ten trajectory rows (A1–A10) are all `passing`.

- Sources are derived, not configured: `local` always, `production` when
  `promises.jaeger` is set. They live in a new module, `lib/promises/sources.ts`
  (subpath `promises/sources`). Cleanup split it out of `telemetry.ts`, which
  went from 640 to 339 lines and lost its import cycle with `probe.ts`.
- `status` prints a section per source. `promise_health` adds `sources`, with
  its top level the alarm source's. The admin draws a chip per source, the alarm
  source's first, and its sidebar's red follows production only.
  `watch --source` now chooses what is read, instead of only labelling the
  incident.
- Structure: 47 commits; 28 files under `apps/` changed, +1,525 / −319. The
  largest files are `sources.ts` (new, 322 lines),
  `promise-sources.test.ts` (new) and `http-promise-sources.test.ts` (new).

Two decisions changed during the work, both recorded where they were made:

- **ADR D3 refined.** D3 said status exits 2 when *any* source fails. A10 of
  `always-on-source.test.ts`, an existing row asserting that a production-naming
  project with no local daemon exits 0, went red under it. The exit code now
  follows the alarm source. "Any source" would have failed every status run on
  a laptop without a daemon running.
- **The alarm source's chip leads.** `http-promise-remote` reads a row's first
  chip. Local-first made that chip *unverified* on a project with no daemon.
  Leading with the chip that raises is the better design anyway.

## Getting to Done

- **A down server read as *watcher blind*.** The probe sends before it asks, so
  a stopped server failed on the send and was called blind. That advises
  looking for a stranger on the port. Found while authoring A4, fixed in Build
  Phase 1: a failed send now asks the query API, and nobody answering is
  *unreachable*.
- **Falsification found two ways one source still took the other down.**
  - A8: `"jaeger": "https://…"`, a string where the object belongs, threw a
    `TypeError` from `url.trim()`. Every reader died, local included.
  - A9: the probe's send ignored the caller's budget. A host that accepts
    connections and never answers held a 2 s admin read for 7 s.
  - Both passed the four build phases' tests, which only ever used well-formed
    config and servers that either answer or refuse.
- **Cleanup found a third.** `status` and `watch` each re-read the raw config to
  build their advice, and printed "Check undefined is up" for the config A8 now
  refuses (A10). Two copies of the same advice were wrong in the same way.
  Extracting one `sourceAdvice`, built from the failure, fixed both.
- **Concurrent test runs.**
  - The evaluator, launched on each commit, ran this plan's system tests while
    I did. Once it ran from its own checkout (`/tmp/eval-<sha>`), once from a
    Claude Code shell in this worktree.
  - Its always-on servers showed up in my leak guard as "left running", with a
    new process ID on each check.
  - Every result recorded here comes from a run with nothing else running and
    the guard clear afterwards.
- **The first full `pnpm test` failed.** 25 admin HTTP tests failed on socket
  errors, and 10 daemons were left running. Under turbo's parallel mcp + admin
  load, `next dev` servers died. The admin suite alone passed 204/204, and the
  rerun of `pnpm test` was green. `http-promise-sources` adds two heavy setups
  to that run and is the first candidate to move out if it recurs.
- **The admin's type check pulled in the mcp test helpers.** Next makes
  `NODE_ENV` required on `ProcessEnv` there, and the helpers' `env` parameters
  failed it. They now take a plain record.

## What We Learned

- **A verification command that matches nothing passes.**
  `pnpm --filter @infinitedusky/indusk-admin` names a package that does not
  exist (it is `indusk-admin`). It prints "No projects matched" and exits 0.
  This plan's impl wrote it into two Verification items, and one archived plan
  did too. The tests were run another way, so nothing false was recorded — but
  the command as written proves nothing.
- **Falsify the inputs the happy path never constructs.** Every build-phase
  test used a well-formed `promises.jaeger` and servers that answer or refuse.
  The two defects falsification found were a malformed config and a server that
  neither answers nor refuses. Both inputs are realistic: someone pastes a URL
  where an object belongs, a cloud host black-holes connections.
- **Duplication hides shared defects.** The two advice copies were each wrong in
  the same way, and each looked locally fine. The defect became visible only
  when cleanup put them side by side.
- **"Isolation per source" has three axes, not one.** A source can fail by
  answer (unreachable, blind), by configuration (a malformed key), or by time
  (silence). A design that isolates only the first still lets the other two
  take every source down.

## What We'd Do Differently

- Write the Test Plan's failure rows across all three axes: answer, config and
  time. Here only the first was planned, and the other two arrived at
  falsification.
- Copy verification commands from a command that has been run, not from
  memory. The `--filter` name was never executed as written.
- Give the evaluator its own checkout every time. Its runs in this worktree made
  every leak-guard reading ambiguous until checked by hand.

## Insights Worth Carrying Forward

- A planned contract can be wrong in a way only an existing test can tell you.
  D3 was accepted, and A10 of `always-on-source` refuted it in one run. Run the
  existing suites early in a build phase, not only at its close.
- An alarm source plus side-by-side display is the general shape for "show
  everything, interrupt for one thing". It will recur when a third source
  (staging) is asked for.

## Shape and quality

- **Shape:** 0 findings raised across seven phases (Test Phase 1, Build Phases
  1–6); 0 judged wrong by a human. Two left-as-is records — `telemetry.ts`
  (Build Phase 1) and `Promises.tsx` (Build Phase 4), both deferred to cleanup
  as module-boundary questions — were both acted on at cleanup. That is the
  division working: Shape declined inter-file work, and cleanup picked it up.
- **Quality ratchet:** no Biome rule fits. The recurring mistakes were an unused
  import left after a move (`noUnusedImports` already catches it, and did) and
  running Biome on a directory rather than named files (it touched nothing
  outside this change). The filter-matches-nothing finding is not lintable by
  Biome. Its guard belongs at verification time: `pnpm --fail-if-no-match`, or
  a check that a Verification command names an existing package.

## Release

Packaged paths changed (`apps/indusk-mcp/src`, `skills/`, `package.json`
exports). This plan adds a capability — local and production read side by side
— so the bump is **minor**: 1.59.0, on main after landing.

Landed on main at 29b22ee4, 2026-10-05.
