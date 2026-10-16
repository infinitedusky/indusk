# looks — rules for working in `lib/looks/`

Loaded by Claude Code when a file here is read. Each entry is a rule and a
pointer; the pointer holds the story.

- **A mockup is read composed, everywhere**: it is linted, shown, hashed and
  checked through `compose.ts` (each `<indusk-component>` replaced by its
  approved snapshot), never from its source bytes alone. Its approval binds
  `componentsHash`, so a changed component reopens exactly the mockups that use
  it. Guarded by `looks-components-cli.test.ts` (A11).
- **A story's approval binds its snapshot and its component's stylesheet; a
  mockup is approved only while every story it composes is**: a rule changed
  in the app's CSS leaves the markup byte-identical, so `stylesheetHash` is
  bound beside `snapshotHash`, and an Approve sends both (a composed mockup's
  sends `componentsHash`, never optional). `approvalOf` reads the story
  approvals, so status, coverage, the check and the overview agree with the
  lint. Guarded by `looks-components-cli.test.ts` (A31, A32).
- **`approvals.ts` is the record and its reading; `approve.ts` is the write
  side**: `approve` and `withdraw` (with `approver`) live in `approve.ts`,
  behind the `./looks/approve` subpath, and only the admin's two routes import
  it; everything that reads a look's state imports `approvals.ts`, which
  exports no write. Guarded by `approvals.test.ts` (A38).
- **Every looks hash is computed in `mockups.ts`**: `sha256`, and
  `snapshotHash` / `stylesheetHash` for the two a story is bound by, called on
  the write side (the catalog, the sheet) and the read side alike — never a
  local `createHash`, so a hash written and a hash read cannot drift. Guarded
  by `stories.test.ts` (A37).
- **A story's check span carries `indusk.look.kind = story`, and a look's
  standing counts only runs of its own kind**: a story's span shares a screen's
  app, name, state and device (`nav.expanded`), so without the kind a held
  story would stand for a broken screen. A span with no kind is a screen's, so
  no recorded run needs rewriting. Guarded by `look-standing.test.ts` (A41).
- **An approval entry records the plan it was made in, and the record stays
  append-only**: `approve` reads the plan from the checkout's branch
  (`plan/x` records `x`; the project's own checkout records none), so a look is
  owned by a plan without a second registry, and a redrawn look's earlier
  entry stays beside the new one as its history. `looks/overview` returns each
  look's `plan`. Guarded by `look-ownership.test.ts` (A4, A7).
- **A test file is never an app's interface or a component's implementation;
  a story is interface**, since it renders an approved snapshot. One
  `isTestFile` in `components.ts`, read by `interfaceFilesAmong`. Guarded by
  `interface-files.test.ts` (A14).
- **A mockup places a component with its own words** — text and placed
  components only; paths are recorded from a second render and held to one
  node structure. See `/decisions/component-content`.
- **A look loads once; every device and scheme is measured on that page**:
  device metrics through Chromium's `Emulation.setDeviceMetricsOverride`, the
  scheme by `emulateMedia`, running `CSSTransition`s finished before each read
  (a switch in place starts them; a fresh load never did), the result returned
  as one JSON string. A page that read its viewport or scheme once on mount
  with no listener (`MOUNT_READS`) is loaded fresh per device and scheme
  instead. The browser still only measures; `checkApp` takes a
  `LookOpener`, so every decision is tested without one. Guarded by
  `looks-check-speed.contract.test.ts` (A11, A12, A36) — see `/decisions/looks-check-speed`.
- **A look is reused only by `reuseOf`, from the record in machine state**
  (`<project home>/looks/<app>.json`, never the checkout): its key is the
  foundation, the checker's own hash (`checkerHashOf`: measured properties
  and their kinds, the measure scripts, `VERDICT_VERSION` — bump it with any
  verdict rule), the declarations, devices and schemes, the configuration,
  its snapshot hashes, for a story the app's element and root rules it draws
  under (the catalog's `baseRulesHash`, from `elementRulesOf`), and for a
  screen the page-code hash and seed; nothing is reused unless
  `components.json`'s `renderedFrom` matches the sources now; only a look held
  everywhere is kept, written over the record as it is at write time; a look
  opened while the server serves a build from before the sources changed is
  reported, never kept; a reused look sends an upheld span marked
  `indusk.look.reused` with `indusk.look.measured_at`, never a bare one. A
  served page that changed outside the sources is in no key — check it with
  `--all`. Guarded by `reuse.test.ts` and `check-run.test.ts` (A1–A9, A19,
  A28–A32, A37) — see `/decisions/looks-check-speed`.
- **A check never crawls a development server**: before any look opens, the
  page at the base URL's own path (and the first story's frame) is read, within
  30 s, and its asset URLs — never its text, which carries data — go to
  `devServerMarker` (Next's HMR client, webpack's refresh runtime, Vite's
  client); a marker refuses, naming `screens.json`'s `serve` (outside the declarations hash). A
  new framework's marker is added there, not worked around with `--url`. The
  same read gives the served build (`servedBuildOf`), judged against the
  sources outside the key (`Build`): a build identity in the key would reopen
  every look on every rebuild. The styling and Storybook configuration and the
  lockfile are in the key (`configHashOf`). Guarded by `dev-server.test.ts`,
  `reuse.test.ts` and `looks-check-speed.contract.test.ts` (A13, A14, A33–A35,
  A38, A39) — see `/decisions/looks-check-speed`.
