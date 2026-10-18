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
  `execution-roots-single-definition.test.ts`; identity, `ps` reads
  (`lib/process-identity.ts`) — `process-identity-single-definition.test.ts`;
  `recordBreaks` — `promises-single-definition.test.ts`;
  `parseWorktreeList` and the
  plan-worktree record — `plan-worktrees-single-definition.test.ts`;
  `src/lib/impl-headings.ts` and one trajectory-row parser —
  `impl-headings.test.ts`; the lifecycle (`lib/lifecycle.ts`: positions,
  activities, `GATE_STAGES`, `RITUAL_ORDER`, `SEGMENT_STATES`, read by
  `parsePlan`, the retrospective gate and the admin) —
  `lifecycle-single-definition.test.ts`; promise health, `promises/health`
  — `promise-health-single-definition.test.ts`; display names and plan dates
  (`promises/display`: `readPlanName`, worktree first) — `display-names-single-definition.test.ts`;
  running test files (`lib/tests/run-files.ts`, used by the plan's test set and
  phase verification) — `run-files-single-definition.test.ts`. A git primitive
  belongs in `lib/git.ts` (`cleanup/oversized.ts`'s synchronous `git()` is the
  one exclusion).
- A plan's folder has one lookup, `findPlanFolder` (`lib/promises/plan-folder.ts`, beside
  `planFolderStatus`): planning folder, then `archive/`, null for the archive folder, a file
  or an unusable name; never a hand-built `.indusk/planning/<plan>` join. Guard: T9,
  `plan-folder-single-definition.test.ts`.
- `machineSecrets()` is the one home of `~/.indusk/config.env`, and the Fly
  config pair is pinned — `server-single-definition.test.ts`; a project names
  a credential's variable, never its value.
- **A new status or kind word is registered with every status-keyed detector
  in the commit that introduces it** — today `archive-dead.ts`
  (`BLOCKING_STATUSES`) and `plan-tools.ts` (`isActivePlanStatus`). — see `/lessons/register-new-vocabulary-with-every-keyed-detector`
- **A newly tracked InDusk artifact is registered with every "what changed"
  detector AND given a merge strategy in the commit that first writes it** —
  `phantom.ts`'s `isMachineState`, `shape/changed.ts`'s `isNotCode`,
  `cleanup/oversized.ts`, and `.gitattributes`; those predicates are
  deliberately not shared. Any detection keyed on "what else changed" excludes
  machine state (`.indusk/verify/`, eval results,
  `.indusk/phase-boundary.jsonl`) and includes untracked files. — see
  `/decisions/lifecycle-rebalance`

## Workbenches and worktrees

- **A safety argument written in a comment is not enforced by the code around it** — grep for comments asserting an invariant and check the control flow delivers it; two workbench-sync paths each reported the worst case as the most reassuring one. — see `/reference/cli/workbench`

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
  not intentions**; the invoker fails loud (exit 2, non-zero, timeout all
  block). — see `/reference/cli/run`
- **`lib/build/`**: `nextBuildStep` (pure), a runner that never starts the
  retrospective, steps under `stepEnv`. One rate-limit rule
  (`session/rate-limit.ts`), one trunk reader (`trunk-branch.ts`). Every
  request a session makes is recorded by the manager with a `decided` event,
  by rule or by person; a decision is never made off the log. Guarded by
  `manager.test.ts`. — see `/reference/cli/plans`
- **`lib/audit/`**: the auditor's inputs. The approved impl is found by the
  approval merge's subject (`plan(<plan>): approved`), never by a line in the
  plan; a rewritten history is named by the refusal and answered with
  `--approved <sha>`. Nothing under `.indusk/` reaches the diff — the plan's
  documents are handed whole, and the folder's diff since approval is the
  builder's notes; a field's `path` names where its text was read
  (`<sha>:<path>` for a committed version), never a working file holding
  something else. A build step's model is `buildStepModel`
  (`lib/build/step-model.ts`), a tier error failing the step. — see
  `/decisions/plan-review-subagent`
- **A release step for a ritual** (Falsify, Cleanup, Audit) reads done from the
  ritual's own files (a closed phase, `audit.md`), never from where the plan
  stands now — a build phase reopened after an audit would hide it. A legacy
  falsification log counts as finished; a skip with a reason wins over a
  finished phase; an open item keeps the ritual unfinished. Guarded by
  `steps.test.ts` and `planning-reader.rituals.test.ts` —
  `promise: a-finished-ritual-stays-done`. `finishedRitualsOf` in
  `cleanup/gate.ts` is the one definition (the retrospective gate and the admin
  both ask it); the admin only passes it on.
- **`indusk verify`** (`lib/verify/`): detects and never repairs — premature
  checkoff, skipped test-first duty (applied to phase N directly), goalpost
  drift, red tests (files + exit codes, never runner output), phantom work
  (narrow by design). It never reports "could not check" as a verdict:
  unresolvable rows are unverified, `readLedger` throws on a malformed line,
  the derived vitest command never passes `--silent`. Ledger failure-safety is
  the inverse of pending-eval's: append only after a clean verdict. — see
  `/decisions/dawn-verify`
- **A plan's tests come from one command, never a hand-picked list**:
  `indusk plans tests <plan> --phase N | --landing` over `planTestSet`
  (`lib/plans/test-set.ts`), the one definition — a phase gets its rows' files
  and what its changes reach, a landing adds the brief's Must-not-break
  promises' `tests:`, nothing else. Reached tests are found by running
  `vitest related`, which cannot list them. Guarded by `test-set.test.ts` (a
  later phase's row stays out, landing holds nothing extra) and
  `skills-run-the-plan-test-set.test.ts` (no skill says `pnpm test`).
  — see `/decisions/tests-never-make-us-wait`
- **The phase-boundary record** (`.indusk/phase-boundary.jsonl`) is generic
  machine state shared by Shape, `verify` and `Challenge`; every changed-file
  scope excludes `.indusk/`; `readBoundaries` throws on a malformed line; the
  writer validates with the reader's predicate (`boundaryRecordProblem`). Every
  way a scope can be wrong is silent, so every fallback over-reports:
  `findPhaseStart` takes the earliest record, untracked files are dated by
  mtime, `verificationIsGreen` counts nested unchecked items — never a box inside a
  task's `<details>` fold or a fence (`foldedLineMask`). — see
  `/guide/shape`
- **Shape's craft rules come from enabled extensions and hardcode none**
  (`lib/shape/rules.ts`); the library supplies facts (`changedFilesForPhase`,
  `collectCraftRules`, three writers through one `appendItemToPhase`).
  **Phase identity is `{kind, number}`**: a bare number is the build phase; a
  boundary record without `kind` is build by rule.
- **The cleanup lib throws on non-git roots and refuses workbench roots by
  declaration**; ritual-phase terminality needs ≥1 item and sees nested
  unchecked items — never a box inside a task's `<details>` fold or a fence
  (`detail-is-only-read.test.ts`, `promise: hidden-detail-is-only-read`).
- `phaseOrdinal` reduces to the phase number when a document has no test
  phase — that reduction is the backward-compatibility guarantee. Gate A
  compares `<=`. A validator parsing zero phases refuses. An unterminated
  fence masks nothing (fails open) so one missing backtick cannot delete every
  phase below it from all three parsers. Falsification log fields are
  single-line; frontmatter regexes for value-bearing keys are line-anchored.

## Promises and telemetry

- A daemon process is InDusk's by `daemonProcessOf` (`daemon-process.ts`: binary +
  `--config` under the home, compared by real path), never by a port, start time or the
  binary existing; `scripts/check-test-daemons.js` keeps a parity copy. Only `stop` removes
  the record (a finder, one naming only dead processes, under the lock): that record is
  lost, not stale. Readers use `resolveLocalDaemon`; a finder writes it by exclusive
  create under `<home>/telemetry.lock`, ports read from sockets, never guessed; code
  deciding about the daemon takes `DaemonReads`. — guarded by the
  `telemetry-daemon-found`, `-readers-follow`, `-daemon-state` and `-test-homes` tests.
- **The real home's daemon runs on the address in `<home>/telemetry-address.json`**,
  chosen once (`PORT_BLOCK` 24316-24319, a port picked once if held), never moved,
  written whole (temporary + rename); only `daemon-address.ts` names a port; a held
  port or an unreadable file refuses a start by name, never reads as none; port options
  only in a temporary home; every start goes through `ensureDaemon`; `indusk telemetry
  address` tells anything else. — guarded by `port-guard.test.ts`,
  `telemetry-start-plan.test.ts` and `telemetry-address.test.ts`.
- **`server deploy` decides from a recorded Fly state**: `planDeploy` is pure,
  every Fly call goes through `FlyCli`, a failed read is refused, never read
  as empty. — see `/reference/cli/server`
- Where a token may sit is `lib/tokens.ts`; an owner is a plan *directory*,
  never `archive`; link paths pass `isUsableRelPath` before any join; a mark's
  project is `markProjectId` (the shared git directory, never
  `basename(cwd)`); a health read never throws.
- **The always-on pass announces once, and only after Slack accepts**
  (`lib/always-on/pass.ts`). **A string from a marked span is untrusted input
  to a plan document** — `incidents.ts`'s `oneLine` collapses `environment`
  and `symptom`; a credential with a line separator is refused by name. The
  image is built from `docker/`, installing the *published* package; the Fly
  reference never auto-stops. — see `/decisions/day-always-on`
- Find a promise with `findPromise` (`lib/promises/registry.ts`; name or alias); the brief-vs-registry-vs-clause-plan-vs-rows rules are `lib/promises/clause-rules.ts`.
- **`.mcp.json` is per machine and untracked**: only `ensureMcpJson` creates it (naming
  `indusk`), and `update` only when none exists; `register` writes only its own
  `jaeger` entry, at the stored MCP port, when it differs. A clone pulling the untracking
  commit loses it once — run `indusk update`. A test of `update` pins
  `INDUSK_SKIP_TELEMETRY_AUTOSTART=1`, or it starts a real daemon. A new plan worktree
  copies the trunk's (`provisionMcpJson`).
- The local daemon is native Jaeger + otelcol (`archive/local-telemetry/adr.md`):
  self-metrics and its own tracing off (`jaeger_query.enable_tracing: false`, the only
  setting that silences it). `reap` stops this home's strays and orphans (a deleted
  home's daemon) only — guarded by the `telemetry-reap-plan` and `telemetry-own-only`
  tests. Binaries are platform-split; registry paths are realpaths; OTel
  instrumentation loads first.
- The daemon promise's reports go through `lib/telemetry/daemon-reports.ts` on the
  SDK-free span path (`watcherSpanBody`), service `indusk-telemetry`, with
  `indusk.clause`; never `initEvalOtel`, which is off when the record is missing and
  follows `OTEL_EXPORTER_OTLP_ENDPOINT`. A loss is reported by whoever finds it.
  — guarded by `telemetry-daemon-reports.test.ts`, `signal-writers.test.ts`.
- `papers.destinations[]` and `promises.domains[]` are ensured on `update`
  through `ensureConfigBlock`; `resolveDestination` is the one resolver and a
  `repo` destination is refused outside a workbench. `indusk papers publish`
  commits in the destination, never pushes by default, pushes last, and never
  lets a git failure escape past a commit it made. — see `/reference/cli/papers`
- **A look's verdict is decided in `looks/verdict` from values handed to it;
  the browser only measures** (`looks/check` passes in `:root` and computed
  styles): a verdict decided where the page runs cannot be read without
  Chromium — guarded by `verdict.test.ts`; see `/reference/cli/looks`
- **A look is touched by its import closure; one that cannot be read touches
  every look** (`looks/touched`; foundation, stylesheets and styling config
  touch all). `check --changed` hands `planReuse` that set — guarded by T10 in
  `touched.test.ts`; see `/reference/cli/looks`
- **The no-raw-value lint is three modules, a new rule in its own**:
  `lint-values`, `lint-classes`, and the token checks in `lint` (which
  orchestrates); `lint-types` holds shared shapes. A rule added to `lint.ts` is
  the 500-line file this split undid — guarded by the file-size attention-focus
  and `looks-lint-rules.test.ts`; see `/reference/cli/looks`

- **What `init` prints is checked against the command line**: every `indusk` command and file `init` prints is checked by `init-next-steps.test.ts`, so a new printed command must exist.

## Eval, agents, skills, extensions

- **A recommendation the new-project flow acts on is named by a constant the agent's prompt reads** (`TELEMETRY_RECOMMENDATION` in `lib/new-project/proposal.ts`), never a word the agent might choose — guarded by T32 in `prompt.test.ts`.
- **Eval agent** ("evaluator", never "judge"): PostToolUse on `git commit`
  only — anchored regex, never `String.includes`; skips when `exit_code` ≠ 0;
  persistent session via `claude --resume`; `--mcp-config .mcp.json` +
  `--permission-mode bypassPermissions` are load-bearing and pinned. **Rail
  invariants**: the resume prompt includes Step 4; `markProcessed` rejects
  duplicates; no backwards-anchoring phrasing; lessons via `add_lesson`; an old
  session pinned to a deprecated model 404s — delete its state. In a workbench
  a commit is attributed to the repository that received it. **A limit refusal
  (`429`, a weekly limit) is *waiting*, not failed** — logged `waiting`, queued
  in `pending.jsonl`, retried by the next commit's trigger before its own
  (`lib/eval/limits.ts`); a reply with no scorecard is asked once more in the
  same session. — see `/guide/rail-check`
- **Thin-lane eval rail**: the loop queues each commit to a pending-eval JSONL
  (absent = empty); `eval-trigger.js --drain-pending` evaluates each once —
  ledger written before spawn, un-drained on a failed evaluator; records carry
  `repo`. The hook only fires inside Claude Code sessions and needs `claude` on
  PATH; check the project home's eval logs when scorecards go
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
  likewise. A phase that edits `skills/` resyncs `.claude/skills/` in the same
  phase and runs `skill-sync-parity.test.ts` — `vitest related` does not reach it.
  **A library the skills call is not shipped until it is in
  `package.json` `exports` AND its documented invocation has run verbatim.**
- **Extensions own tool knowledge**; required-by-default ones flow through
  `autoEnableExtensions` Pass 1 (`disabled_extensions` opts out); they ship
  `.env.example`, never a real `.env`. Enabling ships only `manifest.json`, an
  enabled extension's `on_enable` never fires again, and a file its output
  points at reaches existing projects only via `on_update`; `extensionsDisable`
  fires `on_disable` BEFORE renaming; `INDUSK_BIN` overrides the bare prefix
  in hook commands (test-critical); package-owned files under `.indusk/` are
  machine-local (`MACHINE_LOCAL_RULES`). — see `/lessons/worktree-config-schema-pointer`
- **Releases** (`lib/promises/` and `lib/release/` rules live in those folders' `CLAUDE.md`): `release-guard.sh` refuses dirt on packaged paths, a HEAD not
  `chore(release): <version>`, an unmerged packaged `plan/*` branch and an
  install off the lockfile; `record-release.js` writes "published" only on
  `npm view`'s word; `release-image.sh` pushes the image before `pnpm publish`;
  `prepublishOnly` packs the `.vsix`.
  `lib/release/` has its own `CLAUDE.md`. — see `/reference/cli/release`

- **A session is owned by its project, plan and kind** — `SessionManager.start` refuses only a second session of the same owner, and a start at the machine's cap (`sessions.max` in the InDusk home's `config.json`, default 4, a malformed file reads as 4); readers ask `forPlan(project, plan, kind?)` or `running()`, never "the" session. Guarded by `session/manager.test.ts` (A2, A9). — see `/decisions/sessions-per-plan`

## Tests

- commander@13 drops duplicate parent+subcommand options — declare on the
  parent, read via `optsWithGlobals()`. gray-matter on malformed YAML throws in
  Node but returns `data: {}` under vitest — detect malformed structurally.
- The root run builds this package first (`turbo.json`): a test behind `SHOULD_SKIP` skips silently without `dist/`.
- A helper that starts a process (`runHook`, `validateWrite`, `git`, `runCli`) makes every test calling it a system test: list the file in `vitest.tiers.ts` `SYSTEM`; `everyday-tests-never-wait` reads the helpers and fails the file.
- Fixtures with one home: a versioned workbench —
  `helpers/versioned-workbench.ts` (`LAYOUTS` for `describe.each`; a test about
  where code lives runs over all four); a promise-bearing project —
  `helpers/promises-fixture.ts` (also watched promises, code files,
  incidents); a plan in a worktree —
  `helpers/plan-worktree-fixture.ts`; trunk-guard —
  `helpers/trunk-guard-fixture.ts`; the throwing git runner —
  `helpers/test-git.ts`; MCP tools — `helpers/tool-call.ts`; the built CLI —
  `helpers/cli.ts` (pins `INDUSK_HOME`). Jaeger tests start the real daemon in a
  temporary home on ports the test gives it (`helpers/local-jaeger.ts`); a decision about
  the daemon is a unit test over `helpers/daemon-reads.ts`; the evaluator runs against a fake `claude` +
  `helpers/otlp-capture.ts`; the always-on server via
  `helpers/always-on-server.ts`, a free port via `freeLoopbackPort`; Slack
  via `helpers/slack-capture.ts` — never a stub. — see `.indusk/planning/archive/workbench-trust-fixes/`
