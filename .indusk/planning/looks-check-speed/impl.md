---
title: "Looks check speed"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "17a0300631400adf54eed52b5f974005f4c1df91c6a2d45262d0e95eaca56222"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T11:11:39.862Z"
---

# Looks check speed

## Goal

`indusk looks check <app>` costs what changed: a look whose snapshot,
foundation, declarations, devices and sources are unchanged since it last held
is reported reused from that result without a browser opening it; every look
that is opened loads once and is measured at every device and scheme in place;
a development server is refused with the command that builds and serves the
app; `--all` reopens everything and `--only <name>` checks the named looks.
A reused look sends an upheld signal marked reused, with when it was really
measured, so it keeps reading holding. Landing and release always run the full
`--all` check of the admin, in the slow tier that runs in the background
after landing and at release and never blocks either; plan phases use the fast
default (Sandy, 2026-10-16). Today's full admin run is 1,056 page loads and 25–35 minutes; the brief expects
a one-component change in under 15 s and `--all` in under 60 s against a
production build. See [adr.md](adr.md) and [research.md](research.md).

## Scope

### In Scope
- A held-result record per app in the project's machine-state home, and a pure reuse rule over it.
- Two new hashes in `mockups.ts` (the app's sources; its page sources) and the render step recording what it rendered from.
- One page load per look: device metrics and scheme changed in place, transitions finished, the measurement returned as one string; screens three at a time.
- `--all`, `--only <name>`, the reused output line and summary.
- The dev-server refusal and the optional `serve` declaration, with the admin's.
- A reused look's signal: upheld, marked reused, with the time it was really measured.
- The full check of the admin as a system-tier test, so the slow tier runs it after every landing and at every release; no step declaration changes (the 2026-10-08 rule, kept).

### Out of Scope
- Production looks sampled in rotation — `workbench-server` (Sandy, 2026-10-16).
- Pixel comparison — `.indusk/planning/mockup-matching/`.
- Making the admin's pages render faster (the Looks page's 3.3 s render is the largest single cost left).
- Sharing one load between screen states that are the same page.
- Building or serving the app for the person.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `looks-check-speed.contract.test.ts` and `looks-admin-all.contract.test.ts` (in the system tier), a reused-span case in `look-standing.test.ts`, the slow-look test carrying this plan's promise token, the register | the test plan; `looks-browser.contract.test.ts`'s fixture pattern |
| Build Phase 1 | `measureInPlace` (one load, every device × scheme); a `LookOpener` seam and `CheckOptions` on `checkApp`; `--only`; screens three at a time | `check.ts`'s `measure`, `measureScript`, `openWithinTime`, `judgeLook`, `judgeStory` |
| Build Phase 2 | `sourcesHashOf` / `pageSourcesHashOf` in `mockups.ts`; `renderedFrom` in `components.json`; `looks/reuse.ts` (`lookKey`, `reuseOf`, `heldPath`, `readHeld`, `writeHeld`); `CheckReport.reused`; `--all`; `LOOK_MARK.reused` / `measuredAt` and `reportLooks`'s reused spans | Build Phase 1's seam; `bookkeepingRoots`; `appSourceFiles`, `isImplementationFile`, `isTestFile` |
| Build Phase 3 | `looks/dev-server.ts` (`devServerMarker`); the refusal in `checkApp`; `serve` in `screens.json` and `LooksApp`; the admin's `serve`; the full check of the admin green; the timed live checks | Build Phases 1–2 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A second check with nothing changed opens no page, starts no browser, and reports every look reused with when it last held | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A2 | A changed snapshot, stylesheet, mockup or composed component reopens that look and the screens composing it; every other look is reused | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A3 | Changed devices, ignored tags or source folders reopen every look | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A4 | A look last broken or unchecked is reopened, never reused | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A5 | After a source edit the stories were not rendered from, nothing is reused, and the check says to render the stories | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A6 | A page-code edit reopens every screen and no story; an uncomposed screen is never reused; a changed seed reopens its screen | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A7 | The all option reopens every look whatever was held | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A8 | Held results live in the project's home outside the checkout; a run writes nothing under the checkout; another worktree of the project reads the same results | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A9 | A reused look sends one upheld signal per device and scheme marked reused with the time it was really measured; a measured look's signal carries no reused mark | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A10 | Against real Chromium and a served app, a second run requests no page, prints one reused line per look, counts reused in the summary, exits 0 | Test Phase 1 | Build Phase 2 | passing | contract | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts |
| A11 | Each look's page is requested once, and the look is still reported at every device and scheme under today's names | Test Phase 1 | Build Phase 1 | passing | contract | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts |
| A12 | A page measured in place reads as a fresh load does at every device and scheme, for a colour transition and a pixel-ratio media query | Test Phase 1 | Test Phase 1 | passing | contract | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts |
| A13 | A development server's page (Next HMR client, webpack refresh runtime, Vite client) is refused before any look opens, naming the declared serve command or how to declare one; a production page is not | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/dev-server.test.ts |
| A14 | Against a served page carrying a development marker, the check exits 1 with the refusal and reports no look held | Test Phase 1 | Build Phase 3 | passing | contract | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts |
| A15 | A look that times out twice is unchecked with the reason, a 404 is unchecked at once, any other failure ends the run | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/__tests__/looks-check-timeout.test.ts |
| A16 | With one load per look, a look that does not load or draw in time is unchecked at every device and scheme with the reason, and every other look is judged | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A17 | The only option checks just the looks of that name, screen or story or both, at every device and scheme, measured even when reusable; nothing else is opened or reported | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A18 | The only option with a name no look has is refused, naming it, before any page opens | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A19 | A changed foundation reopens every look; no result held on the old foundation is reported | Build Phase 2 | Build Phase 2 | passing | unit | promise: tokens-are-held-exactly, promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A20 | A page with a raw value is still reported broken, naming the element and the approved and actual values, with in-place measuring | Test Phase 1 | Test Phase 1 | passing | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-browser.contract.test.ts |
| A21 | The new browser tests are in the system tier; the everyday suite starts no browser and no server | Test Phase 1 | Test Phase 1 | passing | unit | promise: everyday-tests-never-wait | apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts |
| A25 | A look reported only as reused, run after run, keeps reading holding in its standing, never no signal | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/promises/look-standing.test.ts |
| A27 | The full check of the admin with every look opened, against its production build, holds every look, and a broken look fails the slow tests | Test Phase 1 | Build Phase 3 | passing | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-admin-all.contract.test.ts |
| A22 | After a one-component change with the stories rendered, the admin's check against a production build finishes under 15 s and names every reused look | Build Phase 3 | Build Phase 3 | skipped | live check | the brief's first expectation, timed once when the build closes | manual: time indusk looks check admin --url http://localhost:3940 |
| A23 | The admin's full check with the all option against a production build finishes under 60 s | Build Phase 3 | Build Phase 3 | skipped | live check | the brief's second expectation, timed once when the build closes | manual: time indusk looks check admin --url http://localhost:3940 --all |
| A24 | Against a running next dev of the admin, the check refuses naming the admin's build-and-serve command, without opening a look | Build Phase 3 | Build Phase 3 | passing | live check | the dev-server clause against the framework itself, whose markers this plan reads but does not own | manual: indusk looks check admin --url http://localhost:3961 |
| A28 | A look opened while the server still serves the build from before the sources changed is reported but not kept held, and the next run against that server opens it again | Build Phase 4 | Build Phase 4 | written | unit | promise: tokens-are-held-exactly, promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A29 | Against a server not rebuilt since a page-code edit, a story whose own inputs are unchanged is reused, and its record keeps the build it was measured on | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A30 | A change to an element, universal or body rule of the app's stylesheet reopens every story that draws under it | Build Phase 4 | Build Phase 4 | written | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A31 | A change to what the check measures or how it judges reopens every look | Build Phase 4 | Build Phase 4 | written | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A32 | Two checks of one project finishing in either order never write back as held a look the other removed | Build Phase 4 | Build Phase 4 | written | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A33 | A server that accepts the connection and never answers the first page does not hang the check; nothing is reused and the looks are opened | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A34 | A production page whose content mentions a development marker is not refused; the page a real next dev serves still is | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/dev-server.test.ts |
| A35 | With a base URL that has a path, the build and the development marker are read at that path, not the origin's root | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A36 | A page that reads its viewport or scheme once on mount, with no listener, is measured at every device and scheme as a fresh load would measure it | Build Phase 4 | Build Phase 4 | written | contract | promise: tokens-are-held-exactly | apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts |
| A37 | A look held at every device and scheme but one, broken or unchecked there, is not kept and is opened on the next run | Build Phase 4 | Build Phase 4 | written | unit | promise: tokens-are-held-exactly | apps/indusk-mcp/src/lib/looks/check-run.test.ts |
| A38 | The served build is told by its scripts, stylesheets and inline styles, never the page's text; the same sources served by another build, a look with no recorded build, and a build that cannot be read reopen the look; after a rebuild from edited sources an unchanged look is reused and its record follows the new build | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |
| A39 | A change to an app's Tailwind or PostCSS config, its Storybook config or the project's lockfile reopens every look it held | Build Phase 4 | Build Phase 4 | written | unit | promise: a-look-check-costs-what-changed | apps/indusk-mcp/src/lib/looks/reuse.test.ts |

### Deferred Verification

- **A held screen whose data changed**
  - reason: the admin's data (plans, promises it renders) is in no key, so a new element with a raw value that appears only because the data changed is reused past
  - would require: a key over the server-rendered page, which costs the server's render (41 s for the admin's screens) and defeats the reuse
  - mitigation: landing and release always run the full check with every look opened (the full-check test in the system tier, run in the background after landing and at release), so the residual lasts at most until the next landing; the ADR names it

## Checklist

### Test Phase 1: Write the browser tests first, failing where the check is slow today

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before the check changes, this phase writes the tests that run the real check in a real browser against a small served app and say what a fast check does: a second run with nothing changed asks the server for no page and says each look was reused; each look's page is asked for once yet reported at every device and colour scheme; a page that a development server would answer is refused. These fail today. Two more pass today and must keep passing once a page is measured in place: a page whose colours transition, or that changes with the screen's pixel ratio, still holds, and a page with a raw colour is still caught. A further test runs the full check of the admin, every look opened, against its production build; it belongs to the slow tests that run in the background after landing and at release, and it fails today because the check has no option to open every look. A look that is only ever reused must keep reading holding, which the standing reader already does for a signal marked reused. The test that a slow look never ends the run already exists and is marked as proving this plan's promise. The tests that decide reuse, the only option and the dev-server markers need code the build phases add, so their bodies are written into the register below. The next phase makes each look load once.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree create looks-check-speed`, or `indusk worktree assign looks-check-speed /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed` for the one `plans start` made — worktree-per-plan default.

  </details>
- [x] Write the browser tests that a check reuses what held, asks for each page once, and refuses a development server, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/looks-check-speed.contract.test.ts`, carrying `promise: a-look-check-costs-what-changed` and `promise: tokens-are-held-exactly` in its docblock, on `looks-browser.contract.test.ts`'s pattern: copy `src/__tests__/fixtures/looks-app` to a temp project, approve `home.empty` at its true hashes (`approve` from `lib/looks/approve.js`), serve pages from a child process (`SERVER`), and run `indusk looks check demo --url <server>` through `runCli` with a temp `INDUSK_HOME`. The server appends each request's path and query to a log file the test reads.
  A10: run twice; the second run's log holds no request, its output has one `reused  home.empty — held …` line and a summary counting `reused`, exit 0. Red today: the second run requests every page again and prints no reused line.
  A11: one run; the log holds exactly one request for `/home?state=empty`, and the output holds a held line at every device × scheme name (`phone`, `phone/dark`, …). Red today: one request per device × scheme.
  A12: a page whose button has `transition: color 300ms, background-color 300ms` and whose `:root` sets `--color-dusk` differently under `@media (min-resolution: 3dppx)` to the dark-only foundation value — each written so a mid-transition or wrong-ratio read is off-token — is held at every device and scheme. Passes today (fresh loads); the tripwire for in-place measuring.
  A14: a page whose HTML references `/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_0b1mqtk._.js`; the run exits 1, its stderr names "development server", and no `held` line is printed. Red today: the page is judged.
  Add the file to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`.

  </details>
- [x] Write the test that the full check of the admin, every look opened, holds every look, failing today.
  <details><summary>Technical</summary>

  A27, new `apps/indusk-mcp/src/__tests__/looks-admin-all.contract.test.ts` (`promise: tokens-are-held-exactly`): start the bundled admin (`apps/indusk-mcp/admin`, built by `test:system`'s `prepublishOnly`) on a free port with a temporary `INDUSK_HOME` that registers this checkout, the way `admin-cli-lifecycle.test.ts` starts the daemon; run `indusk looks check admin --all --url http://localhost:<port>` through `runCli` from the repository root; expect exit 0 and no `broken` line, and print the run's time. Red today: `--all` is an unknown option. Add the file to `SYSTEM`: the slow tier runs it in the background after landing and at release, and a failure there is routed to `tokens-are-held-exactly` as an incident; it never blocks either.

  </details>
- [x] Add a case that a look reported only as reused keeps reading holding.
  <details><summary>Technical</summary>

  A25, `apps/indusk-mcp/src/lib/promises/look-standing.test.ts`: Jaeger-shaped look spans (outcome `upheld`) carrying `indusk.look.reused = true` and `indusk.look.measured_at`, over runs with no fresh measurement, give the look's standing `holding`, never no signal. Passes today: the reader ignores attributes it does not read.

  </details>
- [x] Mark the existing slow-look test as proving this plan's promise.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/looks-check-timeout.test.ts`: add `promise: a-look-check-costs-what-changed` to a docblock (the clause "a slow look never ends the run", shipped in storybook-components). A15.

  </details>
- [x] Confirm no new test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  The contract file imports only existing modules (`approve`, `generateCss`, `readApp`, `runCli`). Red rows fail on their own assertions.

  </details>

#### Deferred to Build Phase 1

- **A16** — its subject is the `LookOpener` seam and the `CheckOptions` argument Build Phase 1 adds to `checkApp`; today `checkApp` launches Chromium itself and takes no opener, so the file would not load the helpers it builds on. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/looks/check-run.test.ts
  // promise: a-look-check-costs-what-changed
  import { checkApp } from "./check.js";
  import { fakeOpener, fixtureApp } from "./check-run.fixtures.js";

  it("a look that does not load in time is unchecked at every device and scheme; the rest are judged", async () => {
    const { app, approvals } = await fixtureApp(["home.empty", "home.full"]);
    const opener = fakeOpener({ "home.empty": "timeout", "home.full": "held" });
    const { results, unchecked } = await checkApp(app, approvals, "http://app", [], { opener });
    expect(unchecked.filter((u) => u.mockup === "home.empty").map((u) => u.device)).toEqual(
      app.devices.flatMap((d) => [d.name, `${d.name}/dark`]),
    );
    expect(unchecked[0].reason).toMatch(/timed out 2 times/);
    expect(results.filter((r) => r.state === "full")).toHaveLength(app.devices.length * 2);
  });
  ```

- **A17** — same subject: the `only` option on `CheckOptions`, added in Build Phase 1. Body reviewed:

  ```typescript
  it("--only checks just the named looks, screen and story alike", async () => {
    const { app, approvals, storyApprovals } = await fixtureApp(["home.empty", "home.full"], ["home.full"]);
    const opener = fakeOpener({ "home.empty": "held", "home.full": "held", "story home.full": "held" });
    const { results } = await checkApp(app, approvals, "http://app", storyApprovals, { opener, only: ["home.full"] });
    expect(opener.opened.sort()).toEqual(["home.full", "story home.full"]);
    expect(new Set(results.map((r) => `${r.kind ?? "screen"}:${r.screen}.${r.state}`))).toEqual(
      new Set(["screen:home.full", "story:home.full"]),
    );
  });
  ```

- **A18** — same subject. Body reviewed:

  ```typescript
  it("--only with a name no look has is refused, naming it, before any page opens", async () => {
    const { app, approvals } = await fixtureApp(["home.empty"]);
    const opener = fakeOpener({ "home.empty": "held" });
    await expect(checkApp(app, approvals, "http://app", [], { opener, only: ["nope.x"] })).rejects.toThrow(/nope\.x/);
    expect(opener.opened).toEqual([]);
  });
  ```

#### Deferred to Build Phase 2

- **A1** — its subject is the held-result record and the `reused` list on the check's report, both introduced in Build Phase 2. Body reviewed:

  ```typescript
  // check-run.test.ts
  it("a second check with nothing changed opens nothing and reports every look reused", async () => {
    const { app, approvals, home, root } = await fixtureApp(["home.empty", "home.full"]);
    const first = fakeOpener({ "home.empty": "held", "home.full": "held" });
    await checkApp(app, approvals, "http://app", [], { opener: first, projectRoot: root, home });
    const second = fakeOpener({});
    const report = await checkApp(app, approvals, "http://app", [], { opener: second, projectRoot: root, home });
    expect(second.opened).toEqual([]);
    expect(second.launched).toBe(false);
    expect(report.results).toEqual([]);
    expect(report.reused.map((r) => r.look)).toEqual(["home.empty", "home.full"]);
    expect(report.reused[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  ```

- **A2**, **A3**, **A4**, **A5**, **A6**, **A7**, **A19** — their subject is `looks/reuse.ts` (`lookKey`, `reuseOf`), which Build Phase 2 creates. One body, a table over each input changed alone:

  ```typescript
  // apps/indusk-mcp/src/lib/looks/reuse.test.ts
  // promise: a-look-check-costs-what-changed
  // promise: tokens-are-held-exactly
  import { reuseOf } from "./reuse.js";
  const story = { kind: "story", name: "badge.ok", foundationHash: "f", declarationsHash: "d",
    devices: "phone,desktop", schemes: "light,dark", snapshotHash: "s", stylesheetHash: "c", current: true } as const;
  const held = { key: story, at: "2026-10-16T03:00:00.000Z", state: "held" as const };

  it("reuses a look whose every input is unchanged", () => {
    expect(reuseOf(held, story)).toEqual({ reuse: true, at: held.at });
  });
  it.each([
    ["snapshot", { snapshotHash: "s2" }], ["stylesheet", { stylesheetHash: "c2" }],      // A2
    ["declarations", { declarationsHash: "d2" }], ["devices", { devices: "phone" }],     // A3
    ["foundation", { foundationHash: "f2" }],                                            // A19
  ])("reopens a look whose %s changed", (changed, patch) => {
    expect(reuseOf(held, { ...story, ...patch })).toEqual({ reuse: false, changed });
  });
  it("reopens a look last broken or unchecked", () => {                                  // A4
    expect(reuseOf({ ...held, state: "broken" }, story).reuse).toBe(false);
    expect(reuseOf(undefined, story).reuse).toBe(false);
  });
  it("reuses nothing when the stories were not rendered from the current sources", () => { // A5
    expect(reuseOf(held, { ...story, current: false })).toEqual({ reuse: false, changed: "stories not rendered from the current sources" });
  });
  it("reopens screens on a page-code edit, never an uncomposed one, and on a changed seed", () => { // A6
    const screen = { kind: "screen", name: "home.full", foundationHash: "f", declarationsHash: "d", devices: "phone,desktop",
      schemes: "light,dark", mockupHash: "m", componentsHash: "k", pageSourcesHash: "p", path: "/home", seed: "", current: true, uncomposed: false } as const;
    const h = { key: screen, at: held.at, state: "held" as const };
    expect(reuseOf(h, { ...screen, pageSourcesHash: "p2" }).reuse).toBe(false);
    expect(reuseOf(h, { ...screen, uncomposed: true }).reuse).toBe(false);
    expect(reuseOf(h, { ...screen, seed: "make-one" }).reuse).toBe(false);
    expect(reuseOf(held, { ...story }).reuse).toBe(true); // the story is not reopened by page code
  });
  it("reopens every look with --all", () => {                                            // A7
    expect(reuseOf(held, story, { all: true })).toEqual({ reuse: false, changed: "--all" });
  });
  ```

- **A8** — its subject is `heldPath` / `readHeld` / `writeHeld` in `looks/reuse.ts`, introduced in Build Phase 2. Body reviewed:

  ```typescript
  it("keeps held results in the project's home, the same from another worktree, and nothing in the checkout", () => {
    const { repo, worktree, home } = gitRepoWithWorktree(); // git init + git worktree add, in a temp dir
    const before = listFiles(repo);
    writeHeld(repo, "admin", { "story:badge.ok": held }, home);
    expect(heldPath(repo, "admin", home).startsWith(join(home, "projects"))).toBe(true);
    expect(heldPath(worktree, "admin", home)).toBe(heldPath(repo, "admin", home));
    expect(readHeld(worktree, "admin", home)["story:badge.ok"]).toEqual(held);
    expect(listFiles(repo)).toEqual(before);
  });
  ```

- **A9** — its subject is the `reused` list Build Phase 2 adds and `reportLooks`'s handling of it. Body reviewed:

  ```typescript
  it("a reused look sends an upheld signal marked reused, with when it was really measured", async () => {
    const { app, approvals, home, root } = await fixtureApp(["home.empty"]);
    await checkApp(app, approvals, "http://app", [], { opener: fakeOpener({ "home.empty": "held" }), projectRoot: root, home,
      now: new Date("2026-10-16T03:00:00.000Z") });
    const report = await checkApp(app, approvals, "http://app", [], { opener: fakeOpener({}), projectRoot: root, home });
    const spans = recordingTracer();
    reportLooks(report.results, spans.tracer, { reused: report.reused });
    expect(spans.all()).toHaveLength(app.devices.length * 2);
    for (const span of spans.all()) {
      expect(span.attributes["indusk.promise.outcome"]).toBe("upheld");
      expect(span.attributes["indusk.look.reused"]).toBe(true);
      expect(span.attributes["indusk.look.measured_at"]).toBe("2026-10-16T03:00:00.000Z");
    }
    const fresh = await checkApp(app, approvals, "http://app", [], { opener: fakeOpener({ "home.empty": "held" }), projectRoot: root, home, all: true });
    const again = recordingTracer();
    reportLooks(fresh.results, again.tracer, { reused: fresh.reused });
    expect(again.all().every((s) => s.attributes["indusk.look.reused"] === undefined)).toBe(true);
  });
  ```

#### Deferred to Build Phase 3

- **A13** — its subject is `looks/dev-server.ts` (`devServerMarker`) and the `fetchPage` option, both introduced in Build Phase 3. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/looks/dev-server.test.ts
  // promise: a-look-check-costs-what-changed
  import { devServerMarker } from "./dev-server.js";
  import { checkApp } from "./check.js";

  it.each([
    ['<script src="/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_0b1mqtk._.js">', "hmr-client"],
    ['<script src="/_next/static/chunks/react-refresh.js">', "react-refresh"],
    ['<script type="module" src="/@vite/client"></script>', "/@vite/client"],
  ])("names the development marker in %s", (html, marker) => {
    expect(devServerMarker(html)).toBe(marker);
  });
  it("finds none in a production page", () => {
    expect(devServerMarker('<link rel="stylesheet" href="/_next/static/chunks/0my-dgs-thrfj.css">')).toBeNull();
  });
  it("refuses before any look opens, naming the declared serve command", async () => {
    const { app, approvals } = await fixtureApp(["home.empty"], [], { serve: "pnpm build && pnpm start" });
    const opener = fakeOpener({ "home.empty": "held" });
    await expect(checkApp(app, approvals, "http://app", [], {
      opener, fetchPage: async () => '<script src="/@vite/client"></script>' })).rejects.toThrow(
      /development server \(\/@vite\/client\).*pnpm build && pnpm start/s);
    expect(opener.opened).toEqual([]);
  });
  it("says how to declare one when the app declares no serve command", async () => {
    const { app, approvals } = await fixtureApp(["home.empty"]);
    await expect(checkApp(app, approvals, "http://app", [], {
      opener: fakeOpener({}), fetchPage: async () => '<script src="/@vite/client"></script>' })).rejects.toThrow(/"serve".*screens\.json/);
  });
  ```

- **A22**, **A23**, **A24** — each is a run of the finished check against the real admin, recorded once with its result; there is nothing to run before Build Phase 3 finishes the check. Their commands are fixed in the trajectory now.

#### Regression Guards

- **A25** — the standing reader counts any upheld look span and ignores attributes it does not read, so a span marked reused already reads holding; the row holds that no later change to the reader discounts reused runs, which is what keeps an unchanged look from decaying to no signal.
- **A12** — today's check loads every device and scheme fresh, so a transitioning page and a pixel-ratio page hold; the row exists to go red if the in-place measuring of Build Phase 1 reads a colour mid-transition or at the wrong ratio.
- **A15** — the slow-look clause shipped in storybook-components; the row holds it while the opening of looks is rewritten.
- **A20** — the raw-value case of `tokens-are-held-exactly` passes today; it must still pass once values are measured in place and returned as one string.
- **A21** — the guard that the everyday suite starts no browser passes once the new contract file is listed in the system tier in this phase; it holds that every later test in this plan stays out of the everyday suite.

#### Test Phase 1 Verification

- [x] The new browser tests exist; the ones for reuse, one request per look and the dev-server refusal fail on their own assertions, and the in-place tripwire passes.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed/apps/indusk-mcp && pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-check-speed.contract.test.ts src/__tests__/looks-browser.contract.test.ts src/__tests__/looks-admin-all.contract.test.ts` — red: A10, A11, A14, A27; green: A12, A20.

  </details>
- [x] The slow-look test, the everyday-suite guard and the reused-standing case pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run src/__tests__/looks-check-timeout.test.ts src/__tests__/everyday-tests-never-wait.test.ts src/lib/promises/look-standing.test.ts` — A15, A21 and A25 green.

  </details>
- [x] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body in the three Deferred sections reviewed against both questions: will it compile at the phase it names (the helpers `fixtureApp`, `fakeOpener`, `recordingTracer` and `gitRepoWithWorktree` are written with it), and does it assert what its row claims?

  </details>

### Build Phase 1: Each look loads once, and one look can be asked for

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase makes every look that is opened cost one page load instead of six. The check loads the page at the first reference device, then for each device sets the page's size and pixel ratio in place and for each colour scheme switches the page's scheme in place, finishing any colour transition the switch started before it reads the values, so a page that animates its colours is not read half-way. The measurement comes back as one string rather than one object per value, which measured ten times faster on the largest pages. Stories follow the switched scheme the way screens do. A page that does not load in time is unchecked at every device and scheme, with the reason, and the run goes on. Screens that need no seed open three at a time. The check also learns to check only the looks a person names. To test those decisions without a browser, the check takes what opens a look as an input. The next phase stops reopening looks that have not changed.

- [x] Make the check load each look's page once and measure every device and colour scheme on that page.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/check.ts`: replace `measure` with `measureInPlace(browser, devices, schemes, url, script, rendered?)`: one `newContext({ viewport: first, deviceScaleFactor: first.pixelRatio, colorScheme: schemes[0] })`, `goto` + settle as today; then for each device `cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: pixelRatio, mobile: false })` (`context.newCDPSession(page)`), for each scheme `page.emulateMedia({ colorScheme })`, then `page.evaluate` of two `requestAnimationFrame`s, then `document.getAnimations().filter((a) => a instanceof CSSTransition).forEach((a) => a.finish())`, then the measure. Returns `Measured[]` in device × scheme order. `measureScript` returns `JSON.stringify(result)`; parse in Node. Measured 2026-10-16: 1,149 ms → 120 ms for 75,815 values.

  </details>
- [x] Make stories follow the scheme switched on the page, as screens do.
  <details><summary>Technical</summary>

  `storyUrl(base, id)` drops the `globals=theme:` parameter, so the admin's preview decorator leaves `data-theme` off (`theme: "match"`) and the story follows `prefers-color-scheme`; `judgeStory` still refuses a page that did not draw the scheme it was opened under. Update `check.test.ts`'s `storyUrl` case.

  </details>
- [x] Make a look that does not load or draw in time unchecked at every device and scheme, with the reason, while every other look is still judged.
  <details><summary>Technical</summary>

  `openWithinTime(() => opener.open(...))` wraps the one load; a `{ timedOut }` or `{ unchecked }` answer expands to one `Unchecked` per `lookDevice(device, scheme)`. A16.

  </details>
- [x] Make the check take what opens a look as an input, so its decisions can be tested without a browser.
  <details><summary>Technical</summary>

  ```typescript
  export interface LookOpener {
    /** Opens `url` once and measures it at each device × scheme; launches the browser on first use. */
    open(target: { look: string; url: string; rendered?: string }, devices: Device[], schemes: Scheme[]): Promise<Measured[]>;
    close(): Promise<void>;
  }
  export interface CheckOptions { opener?: LookOpener; only?: string[]; all?: boolean }
  export async function checkApp(app, approvals, baseUrl, storyApprovals = [], opts: CheckOptions = {}): Promise<CheckReport>
  ```
  The default opener is Chromium (`loadChromium`, `launch`, `measureInPlace`), launched lazily so a run that opens nothing starts no browser. Test helpers `fixtureApp` and `fakeOpener` (records `opened`, `launched`) in `src/lib/looks/check-run.fixtures.ts`.

  </details>
- [x] Make screens that need no seed open three at a time, and seeded screens one at a time after them.
  <details><summary>Technical</summary>

  `pMap` over unseeded `byScreen` groups with `concurrency: SCREENS_AT_ONCE = 3` (the admin's server renders one page at a time; three overlap the browser's work with the next render); seeded groups after, serially, inside `withScreenSeed`. Results keep declaration order.

  </details>
- [x] Add an option that checks only the looks a person names.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/cli.ts` `looks check`: `--only <names...>` (repeatable, comma-separated accepted), passed to `looksCheck` in `src/bin/commands/looks.ts` and on to `checkApp` as `only`. A name selects every screen state `<screen>.<state>` and every story `<component>.<state>` of that name; a name matching neither is a `LooksCheckError` naming it, before anything opens. A17, A18.

  </details>
- [x] Give the older colour-scheme browser test a timeout that fits its two command runs.
  <details><summary>Technical</summary>

  `looks-browser.contract.test.ts`. Found work: the earlier ui-promises plan's case ("a look under a scheme the foundation names is held only when that scheme was opened") makes two CLI runs (~5.7 s) and times out at vitest's 5 s default, so the file's verification below cannot be green. Add an explicit third argument (`30_000`) to that `it`. Reason: the case was already slow before this plan; the verification command runs this file.

  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.
  - Reviewed `check.ts`, `looks.ts`, `cli.ts`, the fixtures and tests. One finding, fixed in place: `check-run.fixtures.ts` re-exported `schemesOf` for no importer (rule: no unused surface). Left as is: `openAndJudge` takes six arguments (it is the one place a look's single load becomes per-device judgements; splitting it would scatter the order contract), and `CheckOptions` has no `all` until Build Phase 2 adds the option with its rule.

#### Build Phase 1 Verification

- [x] Each look's page is asked for once and reported at every device and scheme, the in-place tripwire and the raw-value case still hold, and the only option and the slow-look rule are proven without a browser.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed/apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/check-run.test.ts src/__tests__/looks-check-timeout.test.ts && pnpm exec vitest related src/lib/looks/check.ts src/bin/commands/looks.ts` — A16, A17, A18 green, A15 still green; `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-check-speed.contract.test.ts src/__tests__/looks-browser.contract.test.ts` — A11 green, A12 and A20 still green, A10 and A14 still red.

  </details>
- [x] Types and lint are clean.
  - Result (2026-10-16): `tsc --noEmit` exits 0 and Biome is clean on every file this phase touched. The repo-wide `pnpm check` exits 1 on errors that predate this plan — 112 on main, 111 on this branch, none in a file the plan changed.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-mcp` and `pnpm check` from the worktree root exit 0.

  </details>

#### Build Phase 1 Context

- [x] The looks code's own context file says how a look is opened.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/CLAUDE.md` (area): "**A look loads once; every device and scheme is measured on that page**: device metrics through Chromium's `Emulation.setDeviceMetricsOverride`, the scheme by `emulateMedia`, running `CSSTransition`s finished before each read (a switch in place starts them; a fresh load never did), the result returned as one JSON string. The browser still only measures; `checkApp` takes a `LookOpener`, so every decision is tested without one. Guarded by `looks-check-speed.contract.test.ts` (A11, A12) — see `/decisions/looks-check-speed`".

  </details>
- [x] The root context lists this decision among the key decisions.
  <details><summary>Technical</summary>

  root (Key Decisions): "Looks check speed: a look unchanged since it held is reused from machine state, keyed on its snapshot, the foundation, the declarations, the render's currency and page code; one load per look; dev servers refused — see `/decisions/looks-check-speed`" — always-on because Key Decisions is the one index of every ADR.

  </details>

#### Build Phase 1 Document

- [x] The command reference says each look loads once and how to check one look.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`, section `indusk looks check`: the signature gains `[--only <look>...]`; one paragraph on one load per look and why transitions are finished; `--only` matching screens and stories by name, refused on an unknown name.

  </details>

### Build Phase 2: An unchanged look is reported from its last held result

**Tier**: strong — decides when a look is reported held without being opened; a wrong key would hide a broken look behind a reused one

This phase lets the check skip looks that have not changed. After a run, every look that held at every device and colour scheme is written to a record in the project's own folder outside every checkout, with what it was checked from: its approved snapshot, the foundation, the declared devices and folders, and for a screen the hash of the app's page code and its seed. On the next run, a look whose inputs are all unchanged is reported as reused, with when it last held, and no browser is started for it; a look that was broken or unchecked last time is always opened. Because a story's snapshot is only as new as the last time the stories were rendered, the render step now records which sources it rendered from, and the check reuses nothing when the sources have changed since. A changed foundation reopens every look, so a token change can never be hidden. A reused look still sends a signal to telemetry saying it held, marked as reused and carrying the time it was really measured, so its standing keeps reading holding while no reader mistakes it for a fresh measurement. An option opens every look regardless. The next phase refuses development servers and times the result.

- [x] Compute a hash of the app's sources and a hash of its page code, beside every other looks hash.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/mockups.ts`: `sourcesHashOf(root, app)` — sha256 over `<path>\0<bytes>` of every `appSourceFiles(root, app.sources)` file, sorted by path; `pageSourcesHashOf(root, app, catalog)` — the same over the files that are not a catalogued component's `file`, a story (`isImplementationFile` / the stories glob in `components.ts`) or a test (`isTestFile`). Both through `sha256`, per the looks rule that every hash is computed here.

  </details>
- [x] Make the render step record which sources the stories were rendered from.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/stories.ts` / `stories-catalog.ts` `buildCatalog`: write `renderedFrom: sourcesHashOf(root, app)` at the top of `components.json`; `readCatalog` accepts it as optional. A catalog without it is not current — absence is a rule, not a migration.

  </details>
- [x] Write the rule that decides whether a look's last held result can be reused.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/looks/reuse.ts` (`promise: a-look-check-costs-what-changed`):
  ```typescript
  export type LookKey = StoryKey | ScreenKey; // fields as in the A2 test body; `current` = catalog.renderedFrom === sourcesHashOf(now)
  export interface Held { key: LookKey; at: string; state: "held" }
  export function lookKey(app: LooksApp, look: StoryTarget | LookTarget, facts: { current: boolean; pageSourcesHash: string }): LookKey
  export function reuseOf(held: Held | undefined, now: LookKey, opts?: { all?: boolean }): { reuse: true; at: string } | { reuse: false; changed: string }
  ```
  Pure: every input handed in. `changed` names the first differing input in a fixed order (`--all`, stories not rendered from the current sources, uncomposed, foundation, declarations, devices, schemes, snapshot, stylesheet, mockup, components, page code, path, seed).

  </details>
- [x] Keep each app's held results in the project's machine-state folder, never in the checkout.
  <details><summary>Technical</summary>

  In `reuse.ts`: `heldPath(projectRoot, app, home = induskHome())` = `join(bookkeepingRoots(projectRoot, home).home, "looks", `${app}.json`)`; `readHeld` (missing → `{}`; unreadable → `{}` and a stderr note, never a throw that ends the check); `writeHeld` writes `{ version: 1, looks }` to a temp file and renames it. Keys `story:<name>` / `screen:<name>`. A8.

  </details>
- [x] Make the check report unchanged looks as reused without opening them, and start no browser when nothing needs opening.
  <details><summary>Technical</summary>

  `checkApp`: `CheckOptions` gains `projectRoot`, `home`; `CheckReport` gains `reused: { look: string; kind: "screen" | "story"; at: string }[]`. Before opening, partition the checkable looks with `reuseOf`; looks named by `only` are always opened. After the run, write back: a look held at every device × scheme gets `{ key, at: now, state: "held" }`, a look broken or unchecked anywhere is deleted. `now` is an input (`opts.now ?? new Date()`). `src/bin/commands/looks.ts`: print `reused  <subject> — held <at>, unchanged` per reused look, before unchecked lines; summary `<app>: <h> held, <r> reused[, <u> unchecked]`; a run with no result and every look reused exits 0. A1.

  </details>
- [x] Make a reused look send a signal that it held, marked as reused, with the time it was really measured.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/vocabulary.ts` `LOOK_MARK`: add `reused: "indusk.look.reused"` and `measuredAt: "indusk.look.measured_at"`. `apps/indusk-mcp/src/lib/looks/report.ts` `reportLooks(results, tracer, opts: { project?; reused?: Reused[] })`: for each reused look, one `indusk.looks.check` span per device × scheme (`lookDevice`), the look's app, screen, state, device and kind, `markPromise` outcome `upheld`, plus `reused = true` and `measuredAt = at`. A measured result's span carries neither. `src/bin/commands/looks.ts` passes `report.reused`. Docblock: a reused span is the held result restated, never a measurement (Sandy, 2026-10-16). A9.

  </details>
- [x] Add an option that reopens every look.
  <details><summary>Technical</summary>

  `cli.ts` `looks check --all`, passed as `all` to `reuseOf`. A7.

  </details>
- [x] Make the older colour-scheme browser test open every look on its second run.
  <details><summary>Technical</summary>

  `looks-browser.contract.test.ts`. Found work: the earlier ui-promises plan's case ("a look under a scheme the foundation names is held only when that scheme was opened") checks one project twice, rewriting the served page between runs. The page is written by the test, outside every input a look is reused on, so the second run reported `home.empty` reused and never saw the pinned light theme. Its second run now passes `--all` (the helper `check(root, ...extra)`); the row's assertions are unchanged. Reason: the Build Phase 2 verification runs this file, and a check of a page that changed outside the project's sources is exactly what `--all` is for (the ADR's accepted residual).

  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.
  - Reviewed (2026-10-16, `prepareShapeReview` over 13 files, no extension unreadable): `reuse.ts`, `check.ts`, `mockups.ts`, `components.ts`, `stories.ts`, `report.ts`, `vocabulary.ts`, `looks.ts`, `cli.ts`, the fixtures and tests. Nothing found. The reuse decision is its own pure module with a test seam (`reuseOf`, `lookKey`); `checkApp`'s new work is two named steps (`planReuse` before a run, `keepHeld` after); `reportLooks`' measured and reused spans share one named `startLookSpan`. Left as is: `planReuse` and `keepHeld` live in `check.ts` rather than `reuse.ts`, because they read the run's targets and results and `reuse.ts` stays free of the check's runtime (a type-only import) — where they belong long-term is a module-boundary question for `/cleanup`. `renderedFrom` has no unit test of its own: the render needs Storybook and Chromium; the check's use of it is A5's, and the next live render (Build Phase 3's A22) writes it into the admin's catalog.

#### Build Phase 2 Verification

- [x] A second unchanged run opens nothing and reports every look reused, each changed input reopens exactly what it should, a changed foundation reopens everything, and held results live outside the checkout.
  - Result (2026-10-16): `reuse.test.ts` and `check-run.test.ts` 21 passed; `vitest related` over reuse, mockups, stories and check 319 passed in 50 files — A1–A9 and A19 green, A16–A18 still green.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed/apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/reuse.test.ts src/lib/looks/check-run.test.ts && pnpm exec vitest related src/lib/looks/reuse.ts src/lib/looks/mockups.ts src/lib/looks/stories.ts src/lib/looks/check.ts` — A1–A9 and A19 green, A16–A18 still green.

  </details>
- [x] The browser test for reuse now passes against a real browser.
  - Result (2026-10-16): A10 green; A11, A12, A20 still green; A14 still red (Build Phase 3). `looks-components-cli.test.ts` is in the everyday tier, so it ran under the default config: 21 passed. the earlier ui-promises plan's scheme case needed `--all` on its second run (the found-work item above).
  <details><summary>Technical</summary>

  `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-check-speed.contract.test.ts src/__tests__/looks-browser.contract.test.ts src/__tests__/looks-components-cli.test.ts` — A10 green; A11, A12, A20 still green; A14 still red.

  </details>
- [x] Types and lint are clean.
  - Result (2026-10-16): `tsc --noEmit` exits 0 and Biome is clean on every file this phase touched. The repo-wide `pnpm check` exits 1 on the 111 errors that predate this plan (the same count Build Phase 1 recorded), none in a file the plan changed.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-mcp` and `pnpm check` exit 0.

  </details>

#### Build Phase 2 Context

- [x] The looks code's own context file says when a look is reused and where its last result is kept.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/CLAUDE.md` (area): "**A look is reused only by `reuseOf`, from the record in machine state** (`<project home>/looks/<app>.json`, never the checkout): its key is the foundation, the declarations, devices and schemes, its snapshot hashes, and for a screen the page-code hash and seed; nothing is reused unless `components.json`'s `renderedFrom` matches the sources now; only a look held everywhere is kept; a reused look sends an upheld span marked `indusk.look.reused` with `indusk.look.measured_at`, never a bare one. Guarded by `reuse.test.ts` and `check-run.test.ts` (A1–A9, A19) — see `/decisions/looks-check-speed`".

  </details>

#### Build Phase 2 Document

- [x] The command reference and the guide say what a check reopens, why the stories are rendered first, and when to check everything.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`: `--all`; the `reused` line and summary; where held results are kept (`indusk eval home`'s folder, `looks/<app>.json`); the Mermaid flowchart from the ADR's documentation plan (render current? → key unchanged? → reused; else one load → six measurements → verdict → kept). `apps/docs/src/guide/ui-promises.md`, "checking looks": render the stories after a component change, then check; `--all` at a UI plan's live check, because a screen's data is in no key.

  </details>

### Build Phase 3: A development server is refused, and the speed is measured

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase stops the check from spending half an hour in a development server. Before it opens any look, the check fetches one page over plain HTTP and looks for the code a development server adds to every page — Next's live-reload client, webpack's refresh runtime, Vite's client — and when it finds one it refuses, naming the command that builds and serves the app. That command is a new optional entry in the app's screen declarations; the admin declares its own. The full check of the admin with every look opened is run once here and passes; from then on the slow tests run it in the background after every landing and at every release, while plan phases stay fast. Then the plan's two expectations are timed against a production build of the admin: a check after a change to one component, and a full check of everything, and the refusal is tried against a real development server of the admin. The results are recorded here.

- [x] Write the rule that tells a development server's page from a production one.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/looks/dev-server.ts` (`promise: a-look-check-costs-what-changed`): `devServerMarker(html: string): string | null`, returning the first of `hmr-client` (Next, Turbopack), `react-refresh` (webpack), `/_next/webpack-hmr`, `/@vite/client` found in the HTML, else null. Pure; probed against Next 16.2.4 on 2026-10-16 (research.md).

  </details>
- [x] Make the check refuse a development server before it opens any look, naming the command that builds and serves the app.
  <details><summary>Technical</summary>

  `checkApp`: when at least one look is to be opened, `fetchPage(url)` (option; default `fetch(url).then((r) => r.text())`) of the first screen's `pageUrl`, or of the Storybook frame (`/storybook/iframe.html`) when only stories open; a marker throws `LooksCheckError(`${url} is a development server (${marker}) — build and serve the app, then check again: ${serve}`)`, where `serve` is `app.serve` or `declare the command that builds and serves the app as "serve" in .indusk/mockups/${app}/screens.json`. A run that opens nothing fetches nothing. A13, A14.

  </details>
- [x] Let an app declare the command that builds and serves it, and declare the admin's.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/mockups.ts` `readApp`: optional string `serve` from `screens.json` onto `LooksApp.serve` — not in `declarationsHashOf`, so declaring it reopens nothing. `.indusk/mockups/admin/screens.json`: `"serve": "pnpm --filter indusk-admin build && pnpm --filter indusk-admin start --port 3940"`.

  </details>
- [x] Make a reused result keyed on what is actually served: the served build's identity joins the key, so a check against an old build never records "held" for sources it did not serve.
  <details><summary>Technical</summary>

  Found at Build Phase 2's close (the key describes the sources, not what `--url` serves). Read the served build's id (for a Next app the build id the page carries; `screens.json` may name where an app exposes it) once per run before opening any look; add it to `lookKey` for screens and stories; a run that cannot read it reuses nothing.

  Done as: `servedBuildOf(html)` (`mockups.ts`) hashes the page's script and stylesheet URLs (a production build names them by content hash) and inline styles — never its text, which carries data; null when it has neither. `checkApp` reads the app's root once (and the first story's frame when stories open) before planning reuse, refuses a development server on the same HTML, and judges the result against the sources (`reuse.ts` `Build`, kept on each held record): the same sources must be served by the same build, and edited sources by a rebuilt one — a server still on the build from before an edit reopens the look ("served build not rebuilt"); a build that cannot be read reuses nothing and prints a notice. **Departure from "joins the key"**: a build identity inside the key reopens every look on every rebuild (a one-component edit changes the content-hashed chunks and stylesheet for the whole page — the fingerprinting the ADR rejected), which would defeat A22; so the identity is compared with the sources outside the key, and a reused look's record follows the build it was last judged against. Tests (no trajectory row): `reuse.test.ts` "what is actually served is judged against the sources" — the four same/edited × same/rebuilt cases, a record with no build, an unreadable build, and a run through `checkApp` over edits and rebuilds. Consequence found: a fully reused run makes one plain request (the app root), so A10's body (`looks-check-speed.contract.test.ts`) expects `["/"]` instead of none — its Asserts text is unchanged and still reads "requests no page"; the root is not a look's page, so A11's one request per look's page is untouched.
  </details>
- [x] Make the configuration a look is drawn with part of its key: the styling and Storybook configuration and the lockfile.
  <details><summary>Technical</summary>

  Found at Build Phase 2's close. Hash the app's Tailwind/PostCSS config, the Storybook config folder and `pnpm-lock.yaml` into a `configHash` fact on every look's key in `reuse.ts`.

  Done as: `configHashOf(root, app)` (`mockups.ts`) hashes each source folder's app's `tailwind.config.*`, `postcss.config.*`, its `.storybook` folder and the root `pnpm-lock.yaml`; `configHash` joins `lookKey`'s facts and `COMPARED` (named "configuration"). Tests (no trajectory row): `reuse.test.ts` — a changed `configHash` reopens, and a check after each of a Tailwind config, a PostCSS config, the Storybook config and the lockfile changes opens the held look.
  </details>
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules.
- [x] Shape — reviewed `lib/looks/dev-server.ts` (one pure rule, its markers named), `reuse.ts`'s `configHashOf` and served-build judgement, and the refusal in `check.ts`; nothing to change. `check.ts` has grown past its cap — splitting it is inter-file, `/cleanup`'s at close.
#### Build Phase 3 Verification

- [x] A development server's page is refused before anything opens, a production page is not, and the browser test for the refusal passes.
  - Result (2026-10-16): `dev-server.test.ts` 7 passed (A13); `vitest related` over dev-server, check and mockups 334 passed in 51 files; the system run of `looks-check-speed.contract.test.ts`, `looks-browser.contract.test.ts` and `looks-component-content.contract.test.ts` 12 passed — A14 green, A10, A11, A12, A20 still green.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed/apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/dev-server.test.ts && pnpm exec vitest related src/lib/looks/dev-server.ts src/lib/looks/check.ts src/lib/looks/mockups.ts` — A13 green; `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-check-speed.contract.test.ts src/__tests__/looks-browser.contract.test.ts src/__tests__/looks-component-content.contract.test.ts` — A14 green, A10, A11, A12, A20 still green.

  </details>
- [x] The full check of the bundled admin, every look opened, holds every look.
  - Result (2026-10-16): A27 green; the full check of the bundled admin took 98.9 s (printed by the test), exit 0, no broken look.
  <details><summary>Technical</summary>

  `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-admin-all.contract.test.ts` (after `pnpm run prepublishOnly`, as `test:system` does) — A27 green, its printed time recorded in Notes.

  </details>
- [x] A full check of the admin against a production build finishes in under a minute.
  - Result (2026-10-16): **98.2 s real time, over the 60 s expectation** (exit 0, no look broken: 820 look lines held, 0 reused, 236 unchecked). Render of the stories first: 7.1 s (`indusk looks stories admin`, 146 snapshots for 35 components); the admin's own production build (stories and Next) 15 s. Where the time went: every look is opened and measured in Chromium; the 236 unchecked lines (about 40 looks) are looks the check cannot read in this checkout (see Notes) and, as the unchanged run below shows, account for most of the 57 s that no change removes.
  <details><summary>Technical</summary>

  A23. From the worktree root: `pnpm --filter indusk-admin build && pnpm --filter indusk-admin start --port 3940` (its own production build — the daemon on :3939 serves the main checkout's bundle, and is the person's: do not restart it); `indusk looks stories admin`; then `time indusk looks check admin --url http://localhost:3940 --all` — real time under 60 s, exit 0 or the broken looks named. Record the time, the count of held / broken / unchecked looks, and the render's own time in Notes. Over 60 s is information (the brief's expectation), recorded with where the time went.

  </details>
- [x] A check after a change to one component finishes in under fifteen seconds and names every look it reused. (skipped — asked: "accept the misses as information — the two timing rows skipped with this reason, the floor moved to looks-as-promises — and land the twenty-fold gain now?" — user: "accept")
  - Result (2026-10-16): measured 89–95 s for one component, 98 s for `--all`, 57 s unchanged, against ~35 min before. About 40 looks in this checkout can never be checked (pages that do not report their state; fixture plans answering 404), and an unchecked look is always reopened, so they set a 57 s floor. A22 and A23 are `skipped` with this reason; the floor is carried to `looks-as-promises`.
  - Result (2026-10-16), **not met, left unchecked**: with the stories rendered and the held results from the full run, changing one class of `PlanBadge.tsx` (the `badge` component, rebuilt and restarted on :3940) took **94.6 s** (280 look lines held = 47 looks reopened, 90 reused = 15 looks, 236 unchecked) — the badge is drawn inside the nav, so every screen that composes the nav reopens legitimately. Changing one class of `Tag.tsx` instead (a leaf used by few screens) took **89.4 s** (27 looks reopened, 109 reused lines). A run with nothing changed took **56.8 s** (4 held, 136 reused, 236 unchecked): the floor is the 236 unchecked lines (about 40 looks that a check cannot read here), which are reopened on every run because a look last unchecked is never reused (A4). What the change itself added over that floor: 38 s (badge) and 33 s (tag), which alone is over 15 s. The reused lines are named, one per look. The component change and the re-rendered snapshots were reverted (`git checkout -- apps/indusk-admin .indusk/mockups/admin/components .indusk/mockups/admin/components.json`).
  <details><summary>Technical</summary>

  A22. With the held results from the full run: change one class in `apps/indusk-admin/src/components/ui/PlanBadge.tsx` (the `badge` component) to another token's class, rebuild and restart the server on :3940, `indusk looks stories admin`, then `time indusk looks check admin --url http://localhost:3940` — real time under 15 s; output reopens the badge stories and the screens whose mockups compose `badge`, and prints a `reused` line for every other look. Revert the change and the re-rendered snapshots (`git checkout -- apps/indusk-admin .indusk/mockups/admin/components .indusk/mockups/admin/components.json`); the plan changes no admin source. Record both times in Notes.

  </details>
- [x] Against a running development server of the admin the check refuses, naming the admin's command, without opening a look.
  - Result (2026-10-16): A24 green: against `next dev -p 3961` the check exited 1 in 1.4 s, stderr `http://localhost:3961 is a development server (hmr-client) — build and serve the app, then check again: pnpm --filter indusk-admin build && pnpm --filter indusk-admin start --port 3940`, no `held` line, nothing opened.
  <details><summary>Technical</summary>

  A24. `cd apps/indusk-admin && npx next dev -p 3961` (stop it after); `indusk looks check admin --url http://localhost:3961` exits 1, stderr names `hmr-client` and `pnpm --filter indusk-admin build && pnpm --filter indusk-admin start --port 3940`, and no `held` line. Record the output in Notes.

  </details>
- [x] The brief and the promise registry still agree.
  - Result (2026-10-16): `indusk promises contract looks-check-speed` exits 0 (1 made, 2 kept; 2 expectations); `indusk promises check` exits 0 (150 promises, 0 known-broken).
  <details><summary>Technical</summary>

  `indusk promises contract looks-check-speed` exits 0; `indusk promises check` exits 0.

  </details>

#### Build Phase 3 Context

- [x] The looks code's own context file says a development server is refused, and where the serve command comes from.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/CLAUDE.md` (area): "**A check never crawls a development server**: before any look opens, one page's HTML goes to `devServerMarker` (Next's HMR client, webpack's refresh runtime, Vite's client); a marker refuses, naming `screens.json`'s `serve` (outside the declarations hash). A new framework's marker is added there, not worked around with `--url`. Guarded by `dev-server.test.ts` and `looks-check-speed.contract.test.ts` (A13, A14) — see `/decisions/looks-check-speed`".

  </details>

#### Build Phase 3 Document

- [x] The command reference names the refusal and the serve declaration, the changelog records the change, and the decision is published.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`: the refusal and `serve` in `screens.json`. `apps/docs/src/changelog.md` (Unreleased): "`indusk looks check` checks what changed: an unchanged look is reported reused from its last held result, each look loads once for every device and scheme, a development server is refused with the command that serves the app, and `--all` / `--only <look>` choose what is opened." New `apps/docs/src/decisions/looks-check-speed.md` from `adr.md`, linked from the decisions index.

  </details>

### Build Phase 4: Falsification — a reuse proves only the build it measured

**Tier**: strong — a reused result must never hide a token change

A fresh reader went looking for ways a changed look could be reported held from a reuse, and found some. The worst: when the sources change and the server is not rebuilt, the looks the change reopens are measured against the old build and then kept as held, so every later run against that server reuses a result that never saw the change. This phase stops keeping those results and says the server is serving an old build. It also stops the same check from reopening every story after an edit to page code that the stories never load. Three inputs join what a look is reused on: the element and body rules of the app's stylesheet for stories, and the checker's own measured properties and rules for every look. Two checks of one project running at once no longer overwrite each other's removals. The development-server read gets a time limit, looks for markers only in the files a page loads, never in its text, and reads the page at the base URL's own path. A page that reads its size or colour scheme once when it starts is measured as a fresh load would measure it. Finally, the stale row text and the ADR's list of what no key covers are corrected.

- [x] Stop keeping a look as held when it was measured against a server still serving the build from before the sources changed, and say so.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/check.ts` `planReuse` / `keepHeld`: compute once per kind whether the served build is stale (some held record has `build.served === now.served` and `build.sources !== now.sources`). When it is, a look opened this run is reported and its spans sent, but `keepHeld` deletes its record instead of writing `{ key, at, state: "held", build }`; `rebuilt` is not filled from a stale build. The run's `notice`: `<url> serves a build from before the sources changed — results were not kept; rebuild and serve it: <serve>`. A28.

  Done as: `ReusePlan.stale` per kind; under it `keepHeld` never writes a held record for an opened look and **leaves its earlier record as it was** rather than deleting it (a departure: a deleted record is the only evidence the server is behind its sources, so with one look a third run would find nothing to compare and keep the stale result); a look not held everywhere is still removed. Notices now accumulate (one per line): the stale notice is said whatever was asked for, beside "render the stories" when both hold (A5's scenario is both). `serveCommand(app)` is shared with the development-server refusal.

  </details>
- [ ] Reuse a look whose own inputs are unchanged when only the sources changed and the server was not rebuilt, so an edit to page code no longer reopens every story.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/reuse.ts` `servedAgainst`: the `!sameSources && sameBuild` branch no longer returns "served build not rebuilt" for a look whose key compared equal; it returns null and the caller leaves that look's recorded build as it was (no `rebuilt` entry). `sameSources && !sameBuild` ("served build", the same sources served by another build) is kept. Update `reuse.test.ts:341-342`, which today encodes the reopen. A29.

  </details>
- [ ] Make a story's reuse depend on the element, universal and body rules of the app's stylesheet it draws under.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/component-styles.ts` `componentStylesheet`: also keep rules whose selector targets a tag present in the component's snapshots, a universal selector, `html` or `:root` (resolved as today), so the slice's `stylesheetHash` moves with them. `reuse.ts` `StoryKey`: add `baseHash` (the hash of `_base.css`, read in `mockups.ts` beside the stylesheets, per the rule that every looks hash is computed there). A30.

  </details>
- [ ] Make every look's reuse depend on what the check measures and how it judges.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/mockups.ts`: `checkerHashOf()` = sha256 over `MEASURED_PROPERTIES`, the measure script's text (`measureScript` with empty tokens) and a `VERDICT_VERSION` constant exported from `verdict.ts`, bumped with any change to the verdict's rules. `reuse.ts` `KeyBase.checkerHash`, in `COMPARED` as "checker". A31.

  </details>
- [ ] Keep only this run's own changes when writing the held results, so a check of the same project running at the same time keeps its removals.
  <details><summary>Technical</summary>

  `check.ts` `keepHeld`: re-read the record with `readHeld` immediately before `writeHeld` and apply only this run's writes and deletes (`plan.opened`, `plan.rebuilt`) to it, never `plan.held` wholesale. A deletion by another run between the two reads stands. A32.

  </details>
- [ ] Give the read of the served page a time limit, after which nothing is reused and the looks are opened.
  <details><summary>Technical</summary>

  `check.ts` `readServed`: the default `fetchPage` passes `signal: AbortSignal.timeout(30_000)`; `read` races any `fetchPage` against the same limit (an option, `readTimeoutMs`, so the test injects a short one) and answers null on expiry, which `planReuse` already turns into "could not be read". A33.

  </details>
- [ ] Look for development markers only in the scripts and stylesheets a page loads, never in its text.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/dev-server.ts` `devServerMarker`: match the markers against the `src`/`href` values of `<script>` and `<link>` (the same extraction `servedBuildOf` uses, shared from one place) instead of the whole HTML. Test with a production page whose inline RSC payload contains `react-refresh` and `hmr-client`, and with the HTML A24's `next dev -p 3961` served, saved as a fixture, which must still be refused. Drop `/_next/webpack-hmr` if it appears in no asset URL. A34.

  </details>
- [ ] Read the served page at the base URL's own path.
  <details><summary>Technical</summary>

  `check.ts` `readServed`: `new URL(".", base.endsWith("/") ? base : `${base}/`)` instead of `new URL("/", base)`. A35.

  </details>
- [ ] Measure a page that reads its size or colour scheme once when it starts as a fresh load would.
  <details><summary>Technical</summary>

  `check.ts` `measureInPlace`: an init script (`context.addInitScript`) records whether the page called `matchMedia` without adding a `change` listener to the returned list, or read `innerWidth`/`innerHeight`/`devicePixelRatio` with no `resize` listener on `window`. When it did, measure that look with a fresh context per device × scheme, as before this plan. Contract fixture in `looks-check-speed.contract.test.ts`: a page whose script draws an off-token colour only when `innerWidth < 600` at mount, with phone not first in its devices, reported broken at phone. A36.

  </details>
- [ ] Prove that a look held everywhere but at one device and scheme is not kept.
  <details><summary>Technical</summary>

  `check-run.test.ts`: `fakeOpener` answers held at five device × scheme pairs and broken (and, separately, unchecked) at the sixth; after the run the record has no entry for the look and the next run opens it. Extend `fakeOpener` to answer per device if it cannot today. A37.

  </details>
- [ ] Correct the row that says a second unchanged run requests no page.
  <details><summary>Technical</summary>

  A10's Asserts in the trajectory: "a second run requests only the app's root, no look's page, prints one reused line per look, counts reused in the summary, exits 0"; the same in `test-plan.md`'s A10.

  </details>

#### Build Phase 4 Verification

- [ ] The reuse, check-run and dev-server tests pass, including the new cases for a stale server, a page-code edit, stylesheet and checker changes, concurrent runs, a hung server, page text, a base path and a partly held look.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/looks-check-speed/apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/looks/reuse.test.ts src/lib/looks/check-run.test.ts src/lib/looks/dev-server.test.ts && pnpm exec vitest related src/lib/looks/check.ts src/lib/looks/reuse.ts src/lib/looks/mockups.ts src/lib/looks/component-styles.ts src/lib/looks/dev-server.ts` — A28–A35 and A37 green; A1–A9, A13, A16–A19 still green.

  </details>
- [ ] The browser tests pass, including the page that reads its size once on mount.
  <details><summary>Technical</summary>

  `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/looks-check-speed.contract.test.ts src/__tests__/looks-browser.contract.test.ts` — A36 green; A10, A11, A12, A14, A20 still green.

  </details>
- [ ] Re-rendering the admin's stories after the stylesheet slices change still holds every story against the approved snapshots, or the changed stylesheets are re-approved by a person.
  <details><summary>Technical</summary>

  `indusk looks stories admin`, then `git diff --stat .indusk/mockups/admin/components`; a changed `stylesheetHash` on an approved story is a stylesheet change Sandy approves in the cockpit, not one the agent accepts.

  </details>
- [ ] Types and lint are clean on every file this phase touched.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-mcp`; `pnpm exec biome check` over the touched files.

  </details>

#### Build Phase 4 Context

- [ ] The looks code's own context file says a result measured against an old build is never kept, and what a story's and every look's key now hold.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/CLAUDE.md`, the reuse entry: "a look opened while the server serves a build from before the sources changed is reported, never kept; a story's key holds its slice with the element and body rules it draws under, every key the checker's own hash (`VERDICT_VERSION` is bumped with any verdict rule); development markers are read from asset URLs only. Guarded by `reuse.test.ts` (A28–A32)".

  </details>

#### Build Phase 4 Document

- [ ] The decision and the command reference say what a stale server does to a check, and what no key covers.
  <details><summary>Technical</summary>

  `adr.md` Accepting: add "code outside `sources` that the app imports (the admin reads `@infinitedusky/indusk-mcp`'s parsers) is in no key, like the data it shapes"; Decision 2's amendment: a look measured against an old build is not kept. Mirror both in `apps/docs/src/decisions/looks-check-speed.md`; `apps/docs/src/reference/cli/looks.md`: the stale-server notice and the checker hash.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/looks/check.ts` | `measureInPlace`, `LookOpener`, `CheckOptions` (`opener`, `only`, `all`, `projectRoot`, `home`, `now`, `fetchPage`), `CheckReport.reused`, screens three at a time, dev-server refusal |
| `apps/indusk-mcp/src/lib/looks/reuse.ts` | new: `lookKey`, `reuseOf`, `heldPath`, `readHeld`, `writeHeld` |
| `apps/indusk-mcp/src/lib/looks/dev-server.ts` | new: `devServerMarker` |
| `apps/indusk-mcp/src/lib/looks/component-styles.ts`, `verdict.ts` | Build Phase 4: element, universal and body rules in a story's slice; `VERDICT_VERSION` for the checker hash |
| `apps/indusk-mcp/src/lib/looks/mockups.ts` | `sourcesHashOf`, `pageSourcesHashOf`; `LooksApp.serve` |
| `apps/indusk-mcp/src/lib/looks/stories.ts`, `stories-catalog.ts`, `components.ts` | `renderedFrom` in `components.json`, read as optional |
| `apps/indusk-mcp/src/lib/looks/report.ts` | reused spans: upheld, `indusk.look.reused`, `indusk.look.measured_at` |
| `apps/indusk-mcp/src/lib/promises/vocabulary.ts` | `LOOK_MARK.reused`, `LOOK_MARK.measuredAt` |
| `apps/indusk-mcp/src/lib/looks/CLAUDE.md` | three entries |
| `apps/indusk-mcp/src/bin/cli.ts`, `src/bin/commands/looks.ts` | `--only`, `--all`; reused lines and summary |
| `apps/indusk-mcp/vitest.tiers.ts` | the new contract file in `SYSTEM` |
| tests: `src/__tests__/looks-check-speed.contract.test.ts` (new), `src/lib/looks/{check-run,reuse,dev-server}.test.ts` (new), `src/lib/looks/check-run.fixtures.ts` (new), `src/__tests__/looks-check-timeout.test.ts` (token), `src/lib/looks/check.test.ts` (`storyUrl`), `src/__tests__/looks-admin-all.contract.test.ts` (new), `src/lib/promises/look-standing.test.ts` (a case) | the trajectory |
| `.indusk/mockups/admin/screens.json` | `serve` |
| `CLAUDE.md` | Key Decisions line |
| `apps/docs/src/reference/cli/looks.md`, `guide/ui-promises.md`, `changelog.md`, `decisions/looks-check-speed.md` | docs |

## Dependencies

- `.indusk/planning/storybook-components/` — snapshots, stylesheet hashes, `openWithinTime`, the catalog's Storybook ids.
- `playwright-core` with Chromium installed (already the check's optional dependency); `Emulation.setDeviceMetricsOverride` is Chromium's.

## Notes

- Measured 2026-10-16 (research.md): a screen look costs 16–33 s today (six fresh loads), 9–12 s loaded once, and its measurement 1,149 ms as objects against 120 ms as one string; the server's renders of 48 screen states sum to 41 s. The full run is projected at 50–70 s once this lands (moderate confidence).
- The admin's later re-render after a source change is not timed by the brief; the live checks record it beside the check's time.
- The full check runs in the slow tier, in the background after landing and at release, never blocking either (Sandy, 2026-10-16, keeping the 2026-10-08 rule); a broken look there becomes an incident on `tokens-are-held-exactly`.
- The 60-second full run stays an expectation (Sandy, 2026-10-16); a miss is information.
- The daemon on :3939 is the person's and serves the main checkout's build; every live check here uses the worktree's own build on :3940.
- Measured 2026-10-16, Build Phase 3 (the worktree's own production build of the admin on :3940, a temporary INDUSK_HOME registering this checkout as `dusk`; previously about 35 minutes): render of the stories 7.1 s; full check with `--all` 98.2 s (A23, over the 60 s expectation); the slow-tier test of the same full check 98.9 s (A27); a check after one class of `PlanBadge.tsx` changed 94.6 s, after one class of `Tag.tsx` 89.4 s (A22, over the 15 s expectation); a check with nothing changed 56.8 s; the refusal of `next dev` 1.4 s (A24).
- What keeps A22 and A23 over their expectations: 236 look lines (about 40 looks) come back unchecked in this checkout — `the page did not report state <state>` (the admin draws those states from data this checkout does not hold) and `404 — not in this project` (the `looks-fixture-*` plans) — and a look last unchecked is reopened on every run by design (A4), so they cost 57 s whatever changed. This is a fact about the admin's fixtures, not about the check; making those looks checkable (or declaring their data in their seeds) would bring an unchanged run to seconds, and is not in this plan. Sandy rules whether A22 and A23 are met as information (the brief's expectations are not gates) or the unchecked looks are fixed first.
- A reused result's served build (Build Phase 3): the identity is compared with the sources outside the key, because a build identity inside the key reopens every look on every rebuild; the check makes one plain request to the app's root (and the first story's frame) before planning reuse.
