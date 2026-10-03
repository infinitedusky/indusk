# indusk-mcp — rules for working in this package

Loaded by Claude Code when a file under `apps/indusk-mcp/` is read. Rules that
apply only here; cross-cutting design intent stays in the root `CLAUDE.md`,
and the rules of hooks in `hooks/CLAUDE.md`. Each entry is a rule and a
pointer; the pointer holds the story.

## One home per fact

- `lib/tokens.ts` is the one token grammar for the promise and lesson tokens; a
  new token kind is added there, never as a second pattern. The file that
  documents a marker must not spell one out — the scanner reads it as a
  citation, and refused this package's own docblock the day the grammar moved.
- **Single-definition pins, one each**, every pin's failure naming its lesson:
  `resolveImplPath` (`lib/impl-parser.ts`) and `TERMINAL_STATES`
  (`lib/trajectory/parser.ts`) — `verify/shared-resolution.test.ts`; the async
  `git()` runner (`lib/git.ts`) and the phase-block scan
  (`lib/shape/impl-blocks.ts`) — `shape/shared-definitions.test.ts`;
  `lib/worktree/layout.ts` — `workbench-repos-single-definition.test.ts`;
  `resolveExecutionRoots` (`lib/worktree/roots.ts`) —
  `execution-roots-single-definition.test.ts`; `headSha` / `headShaOrNull`
  (`lib/git.ts`) — `head-sha-single-definition.test.ts`; `ensureConfigBlock`
  (`lib/config.ts`) — `promises-cleanup.test.ts`; `parseWorktreeList` and the
  plan-worktree record — `plan-worktrees-single-definition.test.ts`;
  `src/lib/impl-headings.ts` and one trajectory-row parser —
  `impl-headings.test.ts`; the lifecycle (`lib/lifecycle.ts`: positions,
  activities, `GATE_STAGES`, `RITUAL_ORDER`, `SEGMENT_STATES`, read by
  `parsePlan`, the retrospective gate and the admin) —
  `lifecycle-single-definition.test.ts`. A git primitive belongs in
  `lib/git.ts`; one kept inside a domain folder gets copied by the next domain
  (`cleanup/oversized.ts`'s synchronous `git()` is the one exclusion).
- **The papers module map**: `lib/papers/summary.ts` owns paper parsing and
  `plan-parser.ts` re-exports its names so the `planning/plan-parser` subpath
  holds; `papers/provenance.ts` owns the `published` block's shapes (pinned by
  key count in `papers/shared-definitions.test.ts`); `lib/git.ts` owns
  `snapshotPaths` / `restorePaths`; `papers/publish.ts` is the procedure only.
  A second `data.published as {…}` narrowing under `src/lib` fails the pin.
  Staleness is derived from `paperContentHash` on every read, never stored;
  an unknown status reads `malformed`, never a silent draft. — see
  `/reference/cli/papers`
- **A new status or kind word is registered with every status-keyed detector
  in the commit that introduces it** — today `archive-dead.ts`
  (`BLOCKING_STATUSES`) and `plan-tools.ts` (`isActivePlanStatus`); `published`
  went six phases unregistered. — see `/lessons/register-new-vocabulary-with-every-keyed-detector`
- **A newly tracked InDusk artifact is registered with every "what changed"
  detector AND given a merge strategy in the commit that first writes it** —
  `phantom.ts`'s `isMachineState`, `shape/changed.ts`'s `isNotCode`,
  `cleanup/oversized.ts`, and `.gitattributes`; those predicates are
  deliberately not shared. Any detection keyed on "what else changed" excludes
  machine state (`.indusk/verify/`, `.indusk/eval/`,
  `.indusk/phase-boundary.jsonl`) and includes untracked files. — see
  `/decisions/lifecycle-rebalance`

## Workbenches and worktrees

- **Topology is DECLARED, never inferred** — `worktree.repos[]` with optional
  `path` / `worktrees`; the legacy `wrapped_repo` reduces to a one-element
  list; absence means flat. One reader (`readWorkbenchRepos` + `repoDir` /
  `worktreesDir`), and one home for where a checkout is (`declaredRepoDirs`;
  absent `repos_root` = the parent); `hooks/_hook-paths.js` and `workbench-helpers.sh` carry
  deliberate ports — change all three together. `isWorkbench` is true for any
  config that declares repos. Names and paths are segment-guarded via
  `lib/path-segment.ts`. — see `/reference/cli/workbench`
- **`indusk workbench` = restore / sync / status / migrate-layout**; sync is
  commit → pull → push, inert in normal-mode repos; the wrapped repo is never
  auto-committed; partial failure is loud and non-zero; restore materializes
  each repo at `repoDir(repo)`, idempotently. — see `/guide/workbench-sharing`
- **Ignore rules are generated from declared locations**; a FLAT workbench
  missing the deny-by-default rule is refused, never rewritten
  (`--no-ignore-check`). Generator and checker share named constants.
  `topUpManagedIgnore` tops up per rule, and a guard that returns early for
  one layout must not carry unrelated work behind it. — see
  `/decisions/versioned-workbench`
- **Tooling detection runs over the declared repos, never the wrapper**
  (`detectTooling` over `resolveCheckRoots`); `update` writes
  `verify.testRunner` for a workbench that predates this. So do the lesson
  scan and `check-pointers`: anything reading "what the code says" in a
  workbench reads the declared repos — the wrapper's git ignores them.
- **`indusk verify` judges the code repo**: `resolveExecutionRoots` gives a
  plan root and a code root; red tests run in the code repo, phantom asks "what
  changed" of the code and "what got checked" of the plan; a ledger record
  without `codeSha` is never a code baseline. Zero or several declared repos
  refuse by name. — see `/reference/cli/verify`
- **A plan's live copy is resolved by `lib/worktree/plan-worktrees.ts`**, never
  by matching names: a record in the shared git dir written only by `indusk
  worktree create/assign/release` under a lock, checked against `git worktree
  list` on every read; gone/doubled/missing/malformed are reported, never
  guessed; inert in a workbench. — see `/reference/cli/worktree`
- `indusk setup <cloned-repo>` one-shots workbench creation; its guard is
  config-aware; a failed setup removes only what it created. The worktree
  extension ships a consumer's config schema beside its worktree-configs on
  every enable; `apply_commits[]` is upstream-file-overlay via skip-worktree;
  preflight env is `CHANGED_FILES` + declared `preflight_env{}` globs under
  `set -u`. — see `.indusk/planning/archive/workbench-setup-command/`
- In local mode (`--local`): `.git/info/exclude` handles ignores; `indusk
  pr-clean` / `pr-restore` strip and restore InDusk settings around PRs.

## Run, verify, Shape, cleanup

- **`indusk run`** (`lib/run/`): model-agnostic gated loop; gate chain
  `validate-impl-structure` → `check-gates` → `claude-md-budget`; `ask` is the
  default policy in both lanes (a headless proof-less skip pauses, exit 3);
  two roots in a one-repo workbench, `resolveInRoots` the one confinement rule;
  loop-owned per-item commits, the plan-side checkoff commit carries
  `Code-Commit:` and is never queued for eval. **Its gate covers tool surfaces,
  not intentions** — every mutating tool goes through the envelope, and the
  invoker fails loud (exit 2, non-zero, timeout all block). — see
  `/reference/cli/run`
- **`indusk verify`** (`lib/verify/`): detects and never repairs — premature
  checkoff, skipped test-first duty (applied to phase N directly), goalpost
  drift, red tests (files + exit codes, never runner output), phantom work
  (narrow by design). It never reports "could not check" as a verdict:
  unresolvable rows are unverified, `readLedger` throws on a malformed line,
  the derived vitest command never passes `--silent`. Ledger failure-safety is
  the inverse of pending-eval's: append only after a clean verdict. — see
  `/decisions/dawn-verify`
- **The phase-boundary record** (`.indusk/phase-boundary.jsonl`) is generic
  machine state shared by Shape, `verify` and `Challenge`; every changed-file
  scope excludes `.indusk/`; `readBoundaries` throws on a malformed line; the
  writer validates with the reader's predicate (`boundaryRecordProblem`). Every
  way a scope can be wrong is silent, so every fallback over-reports:
  `findPhaseStart` takes the earliest record, untracked files are dated by
  mtime, `verificationIsGreen` counts nested unchecked items. — see
  `/guide/shape`
- **Shape's craft rules come from enabled extensions and hardcode none**
  (`lib/shape/rules.ts`); the library supplies facts (`changedFilesForPhase`,
  `collectCraftRules`, three writers through one `appendItemToPhase`).
  **Phase identity is `{kind, number}`**: a bare number is the build phase; a
  boundary record without `kind` is build by rule.
- **The cleanup lib throws on non-git roots and refuses workbench roots by
  declaration**; its diff resolves merge bases through fallbacks; `isNew` uses
  `git cat-file -e` exit codes; ritual-phase terminality needs ≥1 item and
  sees nested unchecked items.
- `phaseOrdinal` reduces to the phase number when a document has no test
  phase — that reduction is the backward-compatibility guarantee. Gate A
  compares `<=`. A validator parsing zero phases refuses. An unterminated
  fence masks nothing (fails open) so one missing backtick cannot delete every
  phase below it from all three parsers. Falsification log fields are
  single-line; frontmatter regexes for value-bearing keys are line-anchored.

## Promises and telemetry

- The registry is read through one subpath (`promises/registry`) by CLI, MCP
  and admin; marks are read through one call, `readPromiseMarks`, against one
  endpoint builder, `jaegerEndpoint` (`lib/promises/telemetry.ts`);
  unreachable = exit 2, never zero. A project names its Jaeger in
  `promises.jaeger` (`url` + `credential_env`, the variable's *name*); absence
  means the local daemon; `resolveMarkSource` decides. — see
  `/decisions/day-monitor`
- Where a token may sit is `lib/tokens.ts`; an owner is a plan *directory*,
  never `archive`; link paths pass `isUsableRelPath` before any join; a mark's
  project is `markProjectId` (the shared git directory, never
  `basename(cwd)`); a health read never throws.
- **An opened incident never takes an id its owner's Maintenance phases name**
  (`maintenanceIncidentIds`); `watch` exits 1 for any incident left without
  its owner's phase — opened, extended, or open from an earlier run — and
  retries that reopen every run. — see `/reference/cli/promises`
- **The always-on pass announces once, and only after Slack accepts**
  (`lib/always-on/pass.ts`). **A string from a marked span is untrusted input
  to a plan document** — `incidents.ts`'s `oneLine` collapses `environment`
  and `symptom`; a credential with a line separator is refused by name. The
  image is built from `docker/`, installing the *published* package; the Fly
  reference never auto-stops. — see `/decisions/day-always-on`
- Jaeger v2 is an OTel Collector distribution; self-metrics off via
  `service.telemetry.metrics.level: none`; binaries are platform-split
  optionalDependencies (bump via `packages/telemetry-binaries-shared/UPSTREAM.json`);
  the telemetry registry stores realpath-normalized paths. OTel
  auto-instrumentation must load before other imports.
- `papers.destinations[]` and `promises.domains[]` are ensured on `update`
  through `ensureConfigBlock`; `resolveDestination` is the one resolver and a
  `repo` destination is refused outside a workbench. `indusk papers publish`
  commits in the destination, never pushes by default, pushes last, and never
  lets a git failure escape past a commit it made. — see `/reference/cli/papers`

## Eval, agents, skills, extensions

- **Eval agent** ("evaluator", never "judge"): PostToolUse on `git commit`
  only — anchored regex, never `String.includes`; skips when `exit_code` ≠ 0;
  persistent session via `claude --resume`; `--mcp-config .mcp.json` +
  `--permission-mode bypassPermissions` are load-bearing and pinned. **Rail
  invariants**: the resume prompt includes Step 4; `markProcessed` rejects
  duplicates; no backwards-anchoring phrasing; lessons via `add_lesson`; an old
  session pinned to a deprecated model 404s — delete its state. In a workbench
  a commit is attributed to the repository that received it. — see
  `/guide/rail-check`
- **Thin-lane eval rail**: the loop queues each commit to a pending-eval JSONL
  (absent = empty); `eval-trigger.js --drain-pending` evaluates each once —
  ledger written before spawn, un-drained on a failed evaluator; records carry
  `repo`. The hook only fires inside Claude Code sessions and needs `claude` on
  PATH; check `.indusk/eval/results.log` + `system.log` when scorecards go
  missing. — see `/decisions/dawn-hook-parity`
- **Session IDs sanitize at the boundary** — every session id flows through
  `sanitizeSessionId()` and every section body through `sanitizeSectionBody()`;
  `CLAUDE_CODE_SESSION_ENV_VAR` is the single source for the env-var name.
  `indusk agent register/list/prune/sweep` and the MCP write tool all take the
  `current.md.lock`; `agent list` is an implicit heartbeat that never wipes
  worktree/branch on non-git cwds and flags `⚠ collision`; malformed timestamps
  are KEPT everywhere. — see `/decisions/multi-agent-coordination`
- **Decay**: `indusk agent sweep` archives stale sections
  (`agents.sweep_ttl_minutes`); `indusk plans archive-dead` moves all-draft
  stale plans; archive, never delete; malformed input keeps. **Hub**: `sync
  promote` → `$INDUSK_HOME/hub/lessons/`; `sync pull` is additive, local wins.
  — see `/reference/cli/sync`
- **A skill's `description` is its routing key**; a routing miss is fixed in
  the text, never with a hook. Skills and hooks are package-owned: edit
  `skills/` and `hooks/` here, resync `.claude/skills/` and `.claude/hooks/`;
  `skill-sync-parity` pins byte-equality and the planning context template
  likewise. **A library the skills call is not shipped until it is in
  `package.json` `exports` AND its documented invocation has run verbatim.**
- **Extensions own tool knowledge**; required-by-default ones flow through
  `autoEnableExtensions` Pass 1 (`disabled_extensions` opts out); they ship
  `.env.example`, never a real `.env`. Enabling ships only `manifest.json`, an
  enabled extension's `on_enable` never fires again, and a file its output
  points at reaches existing projects only via `on_update`; `extensionsDisable`
  fires `on_disable` BEFORE renaming; `INDUSK_BIN` overrides the bare prefix
  in hook commands (test-critical); package-owned files under `.indusk/` are
  machine-local (`MACHINE_LOCAL_RULES`). — see `/lessons/worktree-config-schema-pointer`
- **Releases**: `release-guard.sh` refuses dirt on packaged paths, a HEAD that
  is not `chore(release): <version>`, an unmerged packaged `plan/*` branch, and
  an install that does not match the lockfile (`check-install.js`);
  `record-release.js` writes "published" only on `npm view`'s word. — see
  `/reference/cli/release`

## Tests

- commander@13 drops duplicate parent+subcommand options — declare on the
  parent, read via `optsWithGlobals()`. gray-matter on malformed YAML throws in
  Node but returns `data: {}` under vitest — detect malformed structurally.
  Vitest `passWithNoTests: true` is set per app.
- Fixtures with one home: a versioned workbench —
  `helpers/versioned-workbench.ts` (`LAYOUTS` for `describe.each`; a test about
  where code lives runs over all four); a promise-bearing project —
  `helpers/promises-fixture.ts` (also a watched behaviour promise, its code
  files, an open incident); a plan in a worktree —
  `helpers/plan-worktree-fixture.ts`; trunk-guard —
  `helpers/trunk-guard-fixture.ts`; the throwing git runner —
  `helpers/test-git.ts`; MCP tools — `helpers/tool-call.ts`; the built CLI —
  `helpers/cli.ts` (pins `INDUSK_HOME`). Jaeger tests start the real daemon
  (`helpers/local-jaeger.ts`); the evaluator runs against a fake `claude` +
  `helpers/otlp-capture.ts`; the always-on server via
  `helpers/always-on-server.ts`; Slack via `helpers/slack-capture.ts` — never a
  stub. — see `.indusk/planning/archive/workbench-trust-fixes/`
