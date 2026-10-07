---
title: "Demo app template — a seat-holds example in this repository"
date: 2026-10-07
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Demo app template

## Goal

A stranger runs one command and gets the seat-holds example running, its promise holding in the admin; one click on its page breaks the promise, and the admin shows it broken with the span that broke it, in under two minutes. See the [ADR](adr.md), D1–D7.

## Scope

### In Scope
- `examples/seat-holds/`: the rules, the sweeper, the release marks, the server, the page, the fault toggle, its registry, its tests (D1–D5)
- `indusk demo [dir]`, and the example shipped in the package (D6)
- `fly.toml` and `Dockerfile`, deployed once (D7)
- The walkthrough page, the example's README, the CLI reference, the decisions page

### Out of Scope
- A production break, incident recording, the VS Code extension (brief, Not promised)
- Persistence, accounts, more than one promise in the shipped example

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `examples/seat-holds` running locally: rules, marks, page, toggle, registry | the promise mark (always-on guide) |
| Build Phase 2 | `indusk demo`, the example in the package | Build Phase 1's example; `indusk init`, the telemetry daemon, the admin registry |
| Build Phase 3 | the example deployed to Fly once | Build Phase 1's server; Sandy's Fly account |
| Build Phase 4 | the live checks, the docs, the promises confirmed | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A held seat comes free when its window passes; a booked seat never does; a held seat cannot be held by anyone else | Build Phase 1 | Build Phase 1 | passing | unit | the example's own rules, proven for its own promise in its own registry (a copied example carries only its own tokens); InDusk's promises rest on A3, A4 and A7 | examples/seat-holds/src/seats.test.ts |
| A2 | Every release is marked against the promise: held within the window, broken when late, with a symptom naming the seat and how late | Build Phase 1 | Build Phase 1 | passing | unit | the example's own rules, as A1 | examples/seat-holds/src/seats.test.ts |
| A3 | A fresh copy of the example carries its one promise, and InDusk's registry check passes in it | Test Phase 1 | Build Phase 1 | passing | unit | promise: the-demo-app-starts-with-its-promise-holding | apps/indusk-mcp/src/__tests__/demo-example.test.ts |
| A4 | Started with `indusk demo`, the example's marks reach the local telemetry daemon, and InDusk reports its promise holding | Test Phase 1 | Build Phase 2 | passing | contract | promise: the-demo-app-starts-with-its-promise-holding | apps/indusk-mcp/src/__tests__/demo-command.test.ts |
| A5 | From a fresh copy: one command, the seat page, a seat held, booked and released, the admin showing the promise holding | Build Phase 4 | Build Phase 4 | passing | live check | a live check of the start, recorded in Build Phase 4; its promise is proven by A1–A4 | manual: recorded in Build Phase 4 |
| A6 | With the fault switch on, a held seat comes free late and its release is marked broken; off, on time and held | Build Phase 1 | Build Phase 1 | passing | unit | the example's own rules, as A1; the break as InDusk sees it is A7 | examples/seat-holds/src/seats.test.ts |
| A7 | With the switch on, InDusk reports the promise broken within ten seconds of the late release, naming the span; off again with releases on time, the violation is still reported | Test Phase 1 | Build Phase 4 | passing | contract | promise: the-demo-break-is-caught-locally | apps/indusk-mcp/src/__tests__/demo-command.test.ts |
| A8 | The whole break in the admin, from opening the example to the promise broken with its span, under two minutes; with the switch off, still broken | Build Phase 4 | Build Phase 4 | passing | live check | a live check of the break and the brief's second expectation, recorded in Build Phase 4; its promise is proven by A6 and A7 | manual: recorded in Build Phase 4 |
| A9 | The everyday suite still never starts the example, the telemetry daemon or a browser; the guard scans the example's tests too | Build Phase 1 | Build Phase 1 | passing | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A10 | Deployed to Fly from the example's own config, its page answers at the deployed address | Test Phase 1 | Build Phase 3 | passing | smoke | promise: the-deployed-demo-page-answers | examples/seat-holds-smoke-deployed.mjs |

## Checklist

### Test Phase 1: Every row reachable over the CLI or the network, red

**Goal**: author A3, A4, A7 and A10, each failing on its own assertion today, and record why the rest wait.

- [x] Confirm this plan's worktree (`indusk worktree create demo-app-template` made it on `plan/demo-app-template` and recorded the assignment) — worktree-per-plan default
- [x] A3: `demo-example.test.ts` copies `examples/seat-holds` to a temporary folder and runs `indusk promises check` there, expecting exit 0 and `a-held-seat-is-released-in-time` enforced. RED today: there is no example folder
- [x] A4, A7: `demo-command.test.ts`, in the system tier (added to `SYSTEM` in `vitest.tiers.ts`), runs `indusk demo <tmp> --no-open` in a temporary InDusk home, holds and lets a seat lapse over HTTP, and reads `indusk promises status`: holding (A4); then `POST /fault`, a lapse, and broken within ten seconds naming the span, then holding after the toggle is off (A7). RED today: `indusk demo` is an unknown command
- [x] A10: `examples/seat-holds/scripts/smoke-deployed.mjs` requests `SEAT_HOLDS_URL` and exits 0 only on a 200 with the page's title; it carries `promise: the-deployed-demo-page-answers`. RED today: nothing is deployed, and it exits non-zero naming the missing address

#### Deferred to Build Phase 1

- **A1, A2, A6** — their subject is the example's rules module, `examples/seat-holds/src/seats.ts`, which Build Phase 1 creates; a test importing it today fails to load, not on its assertion. Body reviewed:

  ```typescript
  // promise: the-demo-app-starts-with-its-promise-holding
  // promise: the-demo-break-is-caught-locally
  import { describe, expect, it } from "vitest";
  import { createSeats } from "./seats.js";

  describe("seat holds", () => {
    it("A1: a held seat comes free when its window passes; a booked one never does", () => {
      const s = createSeats({ seats: 4, windowMs: 3000, toleranceMs: 1000 });
      expect(s.hold(1, "ann", 0).ok).toBe(true);
      expect(s.hold(1, "bob", 10).ok).toBe(false);
      expect(s.hold(2, "bob", 0).ok).toBe(true);
      expect(s.book(2, "bob", 100).ok).toBe(true);
      const released = s.sweep(3100, { fault: false });
      expect(released.map((r) => r.seat)).toEqual([1]);
    });
    it("A2: a release on time is held; a late one is broken, naming seat and lateness", () => {
      const s = createSeats({ seats: 4, windowMs: 3000, toleranceMs: 1000 });
      s.hold(1, "ann", 0);
      expect(s.sweep(3500, { fault: false })[0]).toMatchObject({ outcome: "upheld" });
      s.hold(2, "bob", 0);
      expect(s.sweep(6200, { fault: false })[0]).toMatchObject({ outcome: "violated", symptom: "seat 2 released 3.2 s late" });
    });
    it("A6: with the fault on, releases are skipped until late", () => {
      const s = createSeats({ seats: 4, windowMs: 3000, toleranceMs: 1000 });
      s.hold(1, "ann", 0);
      expect(s.sweep(3100, { fault: true })).toEqual([]);
      expect(s.sweep(6000, { fault: false })[0]).toMatchObject({ outcome: "violated" });
    });
  });
  ```

- **A9** — the guard's package list gains `examples/seat-holds` once the example exists; before then there is nothing to scan.

#### Deferred to Build Phase 4

- **A5, A8** — live checks of the whole story, run once everything above exists.

#### Test Phase 1 Verification

- [x] (A3 red: "examples/seat-holds is the example to copy: expected false to be true"; A4 and A7 red: "indusk demo printed no seat page: error: unknown command 'demo'"; A10 red: exits 1, "SEAT_HOLDS_URL is not set". The deferred body compiles once `createSeats` exists and asserts A1's three rules, A2's held and broken marks with the symptom, and A6's late release.) A3, A4, A7 and A10 are authored and each fails on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/demo-example.test.ts` for A3; `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/demo-command.test.ts` for A4 and A7; `node examples/seat-holds/scripts/smoke-deployed.mjs` for A10), and the deferred body above is reviewed: it compiles once `seats.ts` exports `createSeats`, and it asserts what A1, A2 and A6 claim

### Build Phase 1: The example runs locally

- [x] `examples/seat-holds/package.json` (its own `name`, `type: module`, scripts `start`, `test`), added to `pnpm-workspace.yaml` as `examples/*`; no dependency on InDusk
- [x] `src/seats.ts`: `createSeats({ seats, windowMs, toleranceMs })` with `hold(seat, who, now)`, `book(seat, who, now)`, `sweep(now, { fault })` returning `{ seat, outcome: "upheld" | "violated", lateMs, symptom? }[]`; the clock is an argument, never read (A1, A2, A6)
- [x] `src/telemetry.ts`: `@opentelemetry/sdk-trace-node` rather than `sdk-node` (the same versions this repository already uses, and none of `sdk-node`'s auto-instrumentation the example does not need), spans exported every half second; with the OTLP HTTP exporter from the standard variables, `service.name = seat-holds`, `deployment.environment` from `SEAT_HOLDS_ENV` (default `local`); `markRelease(result)` opens a span with `indusk.promise = a-held-seat-is-released-in-time`, the outcome, and on a violation the `indusk.promise.violated` event with the symptom
- [x] `src/server.ts`: `node:http` serving the page, `POST /hold`, `POST /book`, `GET /seats`, and `POST /fault` (only when `SEAT_HOLDS_FAULT_TOGGLE=1`; `SEAT_HOLDS_FAULT=slow-release` sets it at start); a sweeper once a second calling `sweep` and `markRelease`
- [x] `public/index.html`: the seats, their state and countdown, Hold and Book buttons, and the "Break it" toggle when the server allows it
- [x] `.indusk/config.json` and `.indusk/promises/a-held-seat-is-released-in-time.md`, owned by the plan it came from, shipped archived at `.indusk/planning/archive/seat-holds/` (a promise's owner must be a plan folder), (behaviour, `enforced`, its test `src/seats.test.ts`, its site `src/telemetry.ts`), so A3 passes in a copy
- [x] A9: the never-wait guard's package list includes `examples/seat-holds`
- [x] Discovered building the example: InDusk's own `promises check` read the example's tokens as this repository's and refused its promise as unknown. A folder with its own `.indusk/config.json` is another InDusk project, so the promise scan (`scannableFiles` in `lib/promises/citations.ts`) now skips everything under it; a folder without one is still read. Proven by `citations.test.ts`, red on the refusal first. The example's files carry only the example's own token: the deploy smoke check moved to `examples/seat-holds-smoke-deployed.mjs`, outside the copied folder, and A1, A2 and A6 now name the example's rules rather than InDusk's promises, which rest on A3, A4 and A7. A3's copy is a git repository, as `indusk demo` makes it, since the check reads files through git

#### Build Phase 1 Verification

- [x] (the example's 3 tests, A3's 2 and the guard's 7 pass; the scanner's related tests 8 files, 73 tests; InDusk's own `promises check` passes with the example in the repository) A1, A2, A6 pass (`pnpm --filter seat-holds test`), A3 passes, and A9 passes with the example scanned (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/demo-example.test.ts src/__tests__/everyday-tests-never-wait.test.ts`)

- [x] Shape — Build Phase 1 wrote `seats.ts` (the rules, one job, the clock an argument), `telemetry.ts` (start, stop, and one mark per release), `server.ts` (routing, the sweeper and shutdown in one small file; splitting a 100-line example server would make it harder to read in a demo) and one static page. The nested-project filter is three lines in the one function that lists scannable files. Nothing to change

#### Build Phase 1 Context

- [x] root (Architecture): `examples/` in the tree, one line: the seat-holds example, tested with the workspace and shipped in the package — always-on because a new top-level folder is orientation every session needs

#### Build Phase 1 Document

- [x] `examples/seat-holds/README.md`: what it is, the promise, how to run it, the fault switch, that seats live in memory

### Build Phase 2: One command

- [x] (`scripts/bundle-example.js`, run by `prepack`; the copy at `apps/indusk-mcp/examples/` is ignored; the release guard's `PACKAGED_PATHS` and its mirror in `version-state.ts` gain `examples/seat-holds`, so a change to the example counts toward a release; the pack test's new case red first) Ship the example in the package: a `prepack` step copies `examples/seat-holds` (without `node_modules`) to `apps/indusk-mcp/examples/seat-holds`, and `files` gains `examples`; `admin-bundle-pack`'s tarball test lists it
- [x] (`src/bin/commands/demo.ts`; `init` already registers the project and starts telemetry, so the command reuses it, and starts the daemon only if it is still not running; the example runs in the foreground until Ctrl-C) `indusk demo [dir] [--no-open]`: refuse a non-empty `dir`; copy the example from the installed package; `git init`, `indusk init`, install; start the telemetry daemon; start the example with `SEAT_HOLDS_FAULT_TOGGLE=1` and OTLP at the daemon; register the project; print the page's and the admin's addresses
- [x] A4 and A7 green in the system tier

#### Build Phase 2 Verification

- [x] (A4 and A7 2 of 2; the pack test's example case passes, its BUILD_ID case needs the admin built, which the system tier's `prepublishOnly` does; `version-state.test.ts` 4 of 4 with the mirror updated; `tsc` clean) A4 and A7 pass
- [x] Shape — Build Phase 2 wrote `demo.ts` (one command: copy, initialise, install, start, in named steps; `exampleSource` is its own function so the shipped and the in-repository paths are one rule) and `bundle-example.js` (one copy, its exclusions named). Nothing to change (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/demo-command.test.ts`), and the package's tarball contains `examples/seat-holds` (`pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-bundle-pack.test.ts`)

#### Build Phase 2 Context

- [x] (delivered where the copy is made rather than in the package's `CLAUDE.md`, which is 2 bytes under its budget: the `.gitignore` line and `bundle-example.js`'s header both say it) mcp: the example is copied into the package at `prepack`, never edited there — the source is `examples/seat-holds`

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/demo.md`: `indusk demo`, its options and refusals, in the sidebar

### Build Phase 3: Deployed once

- [x] (the image builds on Node 24: npm 10 in `node:22-slim` failed to install the tree, "Cannot read properties of null (reading 'edgesOut')", with or without `--omit=dev`; a `.dockerignore` keeps local state out) `examples/seat-holds/Dockerfile` and `fly.toml`: one machine, the page on 8080, OTLP to the project's server through secrets, `SEAT_HOLDS_ENV=production`, no fault toggle
- [x] (Sandy: "go ahead", 2026-10-07; app `seat-holds` in the personal org, `iad`, one shared-cpu-1x 256 MB machine; its OTLP secrets point at `indusk-always-on` with `INDUSK_DEPLOYED_CREDENTIAL`, set without printing it) Deploy once to a Fly app of Sandy's choosing, asking first: it creates a billed app on Sandy's account
- [x] A10 green against the deployed address

#### Build Phase 3 Verification

- [x] ("smoke: https://seat-holds.fly.dev/ answers with the seat page", exit 0; `POST /fault` there answers 403, the switch off as designed; the script moved to `examples/seat-holds-smoke-deployed.mjs` in Build Phase 1) A10 passes
- [x] Shape — Build Phase 3 wrote a 13-line Dockerfile, a `.dockerignore` and `fly.toml`, each one job. Nothing to change (`SEAT_HOLDS_URL=https://<app>.fly.dev node examples/seat-holds/scripts/smoke-deployed.mjs`)

#### Build Phase 3 Context

- [x] current.md: the deployed example's app name and address, for the production act — this session's section, through `update_current_section`

#### Build Phase 3 Document

- [x] `examples/seat-holds/README.md`: deploying to Fly

### Build Phase 4: The live checks, and the promises

- [x] (Sandy, 2026-10-07: run from this branch's build into a fresh folder; the page came up and the admin showed the promise) A5: from a fresh folder, `indusk demo`, the page, a seat held, booked and released, the admin showing the promise holding; recorded with any stop
- [x] (Sandy, 2026-10-07: "I definitely got the violation, that's working"; "overall the demo seems to hold". Stops: the admin was not real time and needed a refresh; "Fix it" read as mending the promise, and the promise showed as a single red square with no held checks around it. The first two are fixed here or recorded; the bar chart is the cockpit's (known-issues.md). The time to broken was not measured: the brief's second expectation is measured at the rehearsal) A8: the break, timed from opening the example to the promise broken with its span in the admin, and still broken after Stop the fault; recorded with the time
- [x] Discovered in the live check (Sandy, 2026-10-07): a promise that says "never" is broken by one violation however many held checks follow, and holds again only once the break is recorded and fixed, which InDusk already models (a violation is unrecorded, then an open incident, then fixed). The example's "Fix it" button and this plan's own promise said otherwise. The promise is reworded (withdrawn and declared again, never in force), A7 and A8 now assert the break stays reported after the switch is off, and the page's button becomes "Stop the fault", saying the promise stays broken until the break is recorded and fixed. A7 moves to pass at Build Phase 4
- [ ] `indusk promises confirm demo-app-template`: the three promises enforced

#### Build Phase 4 Verification

- [ ] A5 and A8 recorded with their results, and the full `pnpm test` and `pnpm test:system` pass from a clean environment

#### Build Phase 4 Context

- [ ] root (Key Decisions): the ADR's one line — the seat-holds example in `examples/`, shipped in the package, started by `indusk demo` — always-on because it is where every demo and launch starts

#### Build Phase 4 Document

- [ ] `apps/docs/src/guide/try-it.md`: the two-minute walkthrough, in the sidebar
- [ ] `apps/docs/src/changelog.md` Unreleased: the seat-holds example and `indusk demo`

## Files Affected

| File | Change |
|------|--------|
| `examples/seat-holds/**` | new: the example |
| `pnpm-workspace.yaml` | `examples/*` |
| `apps/indusk-mcp/src/bin/commands/demo.ts`, `src/bin/cli.ts` | `indusk demo` |
| `apps/indusk-mcp/package.json`, `scripts/` | the example in `files`, copied at `prepack` |
| `apps/indusk-mcp/vitest.tiers.ts` | `demo-command.test.ts` in `SYSTEM` |
| `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts` | scans the example |
| `apps/docs/src/guide/try-it.md`, `reference/cli/demo.md`, `decisions/demo-app-template.md`, `changelog.md` | docs |

## Dependencies

- The local telemetry daemon and the admin, as shipped in 1.64.0
- Build Phase 3: Sandy's Fly account and the project's always-on server

## Notes

- The hold window is a few seconds in the demo, set in the example's configuration, so a break appears inside the two-minute expectation.
