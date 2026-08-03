@AGENTS.md

# dusk — Project Context

## What This Is

A pnpm + Turborepo monorepo containing the InDusk development system. The repo dogfoods its own skill system — the same plan/work/verify/context skills used to build features are also the product being showcased.

## Architecture

```
dusk/
├── apps/
│   ├── indusk-mcp/        # InDusk MCP server — CLI, skills, hooks, lessons, extensions
│   ├── indusk-admin/      # Next.js read-only admin UI (daemon via `indusk ui`)
│   └── docs/              # VitePress docs site (guide / reference / decisions / lessons)
├── packages/              # telemetry-binaries-* — platform-split jaeger + otelcol
├── .claude/skills/        # Installed skills — package-owned, synced from apps/indusk-mcp/skills/
├── .claude/lessons/       # Lessons registry — titles are the rules; bodies load on demand
├── docker/                # Dockerfiles (Dockerfile.infra retired by indusk-makeover)
├── biome.json             # Quality ratchet — see biome-rationale.md for per-rule why
├── vitest.config.ts       # Workspace projects; apps inherit via extends
├── .indusk/               # InDusk home — planning/, extensions/, config.json, current.md
└── CLAUDE.md              # This file — living project memory (60 KB budget, hook-enforced)
```

**Apps:**

- **indusk-mcp** — the InDusk MCP server + CLI (`init`/`update`/`setup`/`extensions`/`agent`/`plans`/`sync`/`context`/`eval`/`ui`/`telemetry`/`worktree`). Published as `@infinitedusky/indusk-mcp`. Skills in `apps/indusk-mcp/skills/*.md` sync to consumers' `.claude/skills/` on init/update (globSync, both sides). Hooks in `apps/indusk-mcp/hooks/*.js` install to `.claude/hooks/`. Git is the only SCM (1.31.0); commit IDs via `apps/indusk-mcp/src/lib/scm/index.ts`. Retired MCP servers are removed via the shared `apps/indusk-mcp/src/lib/mcp-migration.ts` helper (init + update both call it) — extend `LEGACY_MCP_SERVERS` on future retirements, never hand-roll a removal loop. The `doppler` extension is the default env layer (per-worktree auto-provisioning); composable.env is deprecated opt-in.
- **`indusk run <plan> --model <name>`** (Dawn external orchestrator, `apps/indusk-mcp/src/lib/run/`) — plan phases through a model-agnostic gated AI-SDK loop: per-phase scope, advance-on-green via a deliberate `check-gates` probe, goalpost guard, human-gate pause; direct provider keys via the registry. Gate chain is three shared scripts (`validate-impl-structure` → `check-gates` → `claude-md-budget`); `gate-reminder` deliberately shed (dawn-hook-parity ADR). The loop commits per checklist item (loop-owned, intent-derived messages; failures loud-but-non-gating; non-git worktrees disable cadence loudly). — see `/reference/cli/run`
- **indusk-admin** — Next.js App Router read-only viewer over `.indusk/planning/` + `.indusk/eval/`, hosted as a single machine-global daemon (`indusk ui start/stop/restart/status`, registry `~/.indusk/projects.json`, routes `/p/[project]/...`). Custom Tailwind primitives (no shadcn/Radix); reuses indusk-mcp parsers via workspace subpath exports — never duplicate parsing. Bundled pre-built into the tarball by `prepublishOnly` (`apps/indusk-mcp/scripts/bundle-admin.js`). — see `/decisions/admin-ui-hosting`
- **docs** — VitePress site. Every plan contributes pages at close (decisions/lessons/reference); ADRs publish to `/decisions/*`.

**MCP servers** (project `.mcp.json` keep-list, indusk-makeover): **indusk** (dev-system tools), **dash0** (hosted observability; `Authorization: Bearer ${DASH0_AUTH_TOKEN}` — token lives in `~/.indusk/config.env`, never committed), **jaeger** (local-telemetry daemon's MCP — critical), **posthog**. Global keep-list: **playwright** only. Graphiti + codegraphcontext are retired — `init`/`update` remove stale registrations. — see `.indusk/planning/indusk-makeover/adr.md`

**Skills** (process): planner, work, verify, context, document, retrospective, catchup, handoff, falsify, cleanup, highlight, rail-check, git, eval-review, toolbelt. Each concept has one canonical skill; edit in `apps/indusk-mcp/skills/`, never `.claude/skills/` directly.

**Agent roles** (three tiers — see `.indusk/planning/archive/agent-roles/adr.md`): the **working agent** does the user's task and flags moments via `mcp__indusk__highlight`; the **eval agent** (background, fires on `git commit` + session end) scores work and materializes durable highlights into **lessons** via `add_lesson` (indusk-makeover retargeted it from Graphiti); **infrastructure** (hooks, CLI, validators) enforces invariants. The working agent never materializes highlights itself.

## Conventions

- pnpm workspaces + Turborepo; **Node 22 required** (Tailwind 4 native bindings).
- **Biome, not ESLint** — `pnpm check` / `pnpm check:fix` / `pnpm format`. Biome config is a knowledge artifact (`biome-rationale.md`); the ratchet only tightens. After each retrospective ask if a mistake could become a Biome rule.
- `pnpm test` runs all; `pnpm turbo test --filter={app}` scopes. Vitest `passWithNoTests: true` must be set per-app (root `extends: true` doesn't inherit it).
- **CLAUDE.md has a hard 60 KB budget enforced at write time** — `claude-md-budget.js` PreToolUse hook blocks past `context.claude_md_budget_bytes` (61440 default; warns at 90%). Entries are 1–3-line rules + pointer. Compact, don't grow; raise the budget only as a deliberate config edit. `indusk context check-pointers` verifies pointers resolve. — see `/guide/context-budget`
- **Decay layer**: `indusk agent sweep` archives current.md sections older than `agents.sweep_ttl_minutes` (7d default; ≫ the 60-min display TTL) to `.indusk/archive/current-md-archive.md`; `indusk plans archive-dead` moves all-draft stale plans (`planning.dead_draft_days`, 30d) to `planning/archive/`. Archive, never delete; malformed input blocks/keeps; master.md non-draft rows protect plans. — see `/reference/cli/plans`
- **Hub push/pull**: `indusk sync promote <lesson>` → machine-global hub (`$INDUSK_HOME/hub/lessons/`, provenance-stamped, manifest-versioned); `indusk sync pull` (run by catchup) merges hub + bundled community channel — additive-only, idempotent, local wins. — see `/reference/cli/sync`
- **`/catchup` is dieted**: no CLAUDE.md re-read (auto-injected), targeted current.md reads (shared region + live sections keyed off `agent list`), `list_plans { active: true }`, sweep dry-run + hub pull. `/handoff` runs the real sweep. Measured 55k → ~8.2k tokens. — see `/reference/skills/catchup`
- **`.indusk/current.md` is per-agent sections** (`## Project (shared)` anchor + `## Session <short> — <task>` blocks, matched by full UUID from `**Session ID**:`); CLAUDE.md is the architectural layer, current.md the operational layer. Write your section only via `mcp__indusk__update_current_section` (typically at `/handoff`); commit like any file. `merge=union` in `.gitattributes` merges concurrent appends; all mutations go through the `current.md.lock` file lock (the load-bearing primitive in workbench mode, where the root isn't a git repo). — see `/decisions/multi-agent-coordination`
- **Session IDs sanitize at the boundary** — every `$CLAUDE_CODE_SESSION_ID` / `--session-id` flows through `sanitizeSessionId()` (`apps/indusk-mcp/src/lib/agents/session.ts`) before any path join; section bodies flow through `sanitizeSectionBody()` (rejects the four structural marker patterns). Never bypass these chokepoints. `CLAUDE_CODE_SESSION_ENV_VAR` is the single source for the env-var name.
- **`indusk agent list` shows worktree/branch recomputed live and is an implicit self-heartbeat**; it flags `⚠ collision` when ≥2 live sessions share a tree. The heartbeat preserves last-known worktree/branch on non-git cwds (the workbench root is deliberately not a git repo). — see `/decisions/worktree-visibility`
- **Worktree-per-plan is the default**: every impl's Phase 1 opens with a worktree kickoff; opt out via `worktree: none` (also `no`/`off`/`false`/`skip`) in impl frontmatter. `resolveWorktreeDecision` + `detectTreeContext` in `apps/indusk-mcp/src/lib/worktree/decision.ts`.
- Plans live in `.indusk/planning/{kebab-case}/` following research → brief → test-plan → adr → impl → retrospective. Use `/planner` before implementing; don't jump to code. Cross-reference related plans by path; update both when work overlaps.
- **Plan hierarchy is declared top-down, in frontmatter**: the root `master.md` names `parents:` + the `roadmap:` order; each parent's own `master.md` names its ordered `subplans:`. Children declare nothing — one source of truth per link, so the two sides can't drift. **The plan inventory always comes from disk** (`parseAllPlans`), never from a list; declarations add structure and can never subtract a plan. A missing/corrupt/absent key degrades to the flat list. Declaration names are boundary values — segment-guarded (no `/`, `\`, `..`) and first-occurrence-deduped inside `readPlanDeclarations` before any path join or render. Archived children resolve as real items (active wins name collisions), never placeholders. `readPlanDeclarations` in `apps/indusk-mcp/src/lib/plan-parser.ts`. — see `/reference/cli/plans`
- **Every impl phase has gates** (implementation, verification, context, document; OTel only when `otel.role` is unset/`service` — dusk is `library`, so no OTel sections here). Hooks enforce: `validate-impl-structure.js` at write time, `check-gates.js` at phase transitions, `gate-reminder.js` nudges. Gate policy via `gate_policy` frontmatter (`strict`/`ask`/`auto`, default `ask` — skips need conversation proof).
- **Test Trajectory** is mandatory in new impls (`trajectory: required`): table `ID | Asserts | Writable at | Passes at | State`, IDs `T`- or `A`-prefixed (`/\b[TA]\d+\b/` — deliberately not `[A-Z]`), phase Verification references IDs, Deferred Verification rows need `reason:`/`would require:`/`mitigation:`, `### Trajectory Rationale` required for Phase 1+ writable rows (`rationale_baseline: N` exempts refactor baselines). Writable-at = earliest authorable phase, not the fix phase. — see `/decisions/tests-first-planning` + `/guide/test-trajectory`
- **Close-out rituals**: `/work` → `/falsify` (authors a Falsification Phase — never runs tests inline) → `/work` → `/cleanup` (decomposition ritual; `cleanup` config block threshold is attention-focus, NOT a blocking cap) → `/work` → `/retrospective`. Retrospective Step 0 hard-blocks unless both rituals are terminal or explicitly skipped (`falsification: skipped` + reason / `cleanup: skipped` + reason). Ritual-phase detection matches titles that START with the ritual word. — see `/decisions/falsification-ritual` + `/decisions/cleanup-ritual`
- **Retrospective compaction step**: plan close demotes the plan's Current State narrative to one line + archive link, compresses any Conventions entries it authored to rule + pointer, and collapses one old entry per close (the periodic pass). — see `/guide/context-budget`
- **Eval agent** ("evaluator", never "judge"): PostToolUse hook on `git commit` only — regex `/\bgit commit(?=$|\s|;|&|\|)/` (anchored + right-edge lookahead; never String.includes for shell triggers). Skips when `tool_response.exit_code` ≠ 0. Persistent session via `claude --resume`; `--mcp-config .mcp.json` + `--permission-mode bypassPermissions` are load-bearing for MCP access. `eval.model` config (default sonnet) affects fresh calls only. Findings persist via `indusk eval findings/fix/ignore`. Disable per-project with `eval.enabled: false`. — see `.indusk/planning/archive/eval-agent-mcp-access/`
- Verification items in impls are runnable commands with expected output, never "verify it works". Before touching shared code, grep for importers/callers to understand blast radius.
- Commit cadence: one commit per checklist item on a `plan/{name}` branch; `git add -p`, intent-named messages; merge + delete fast. MonoRepo commits stay siloed per context.
- Extensions own tool knowledge (health checks, setup, verification) — don't hardcode tool facts in indusk-mcp core. Required-by-default extensions flow through `autoEnableExtensions` Pass 1; opt out via `disabled_extensions` in config. Extensions ship `.env.example` as the env-var source of truth — NEVER a real `.env`.
- **`indusk setup <cloned-repo>` one-shots workbench creation** (symlink-in-place trunk + delegate to `init --workbench`); config-aware collision guard; atomic cleanup on failure. Workbenches are per-developer scaffolding — only the wrapped repo is shared. — see `.indusk/planning/archive/workbench-setup-command/`
- In local mode (`--local`): `.git/info/exclude` handles ignores (per-clone); `indusk pr-clean`/`pr-restore` strip/restore InDusk settings around PRs.

## Key Decisions

- Context skill is pure markdown instructions; CLAUDE.md keeps a fixed 6-section structure — see `.indusk/planning/archive/context-skill/adr.md`
- Biome over ESLint; global config is the floor, project extends — see `.indusk/planning/archive/code-quality-system/adr.md`
- Vitest as committed test runner with adaptive first-connect setup — see `.indusk/planning/archive/verify-skill/adr.md`
- Document skill (per-phase gate) + retrospective skill (closing audit + docs handoff) — see `.indusk/planning/archive/document-skill/adr.md`
- GSD-inspired: lessons registry, boundary maps, blocker protocol, forward intelligence — see `/decisions/gsd-inspired-improvements`
- Plan-gate enforcement via Claude Code PreToolUse hooks — see `.indusk/planning/archive/enforce-plan-gates/adr.md`
- Extension system: one system, two sources (built-in + third-party), replaced domain skills — see `.indusk/planning/archive/extension-system/adr.md`
- Excalidraw for informal diagrams, Mermaid for formal; ExcalidrawEmbed in VitePress — see `/decisions/excalidraw-extension` + `/decisions/vitepress-excalidraw-embed`
- OTel as core instrumentation, role-aware gate via `otel.role` — see `/decisions/otel-extension`
- Local init mode (`.indusk/` home, `config.json` profile, `--local`) — see `/decisions/local-init-mode`
- Test Trajectory as canonical impl shape; four validator rules; structural phase-close gating — see `/decisions/tests-first-planning`
- Falsification ritual between work and retrospective (goal-flipped bounty hunt; phase-authoring as of 1.27.4) — see `/decisions/falsification-ritual`
- Cleanup ritual as falsify's twin (no fifth gate, no LOC ratchet — threshold is attention-focus) — see `/decisions/cleanup-ritual`
- Three-tier agent roles + highlights queue — see `.indusk/planning/archive/agent-roles/adr.md`
- Admin UI: standalone Next.js read-only viewer — see `/decisions/indusk-admin-ui`; hosted as machine-global daemon + registry — see `/decisions/admin-ui-hosting`
- Local telemetry: native-binary Jaeger + otelcol daemon, `indusk telemetry *` CLI, jaeger_mcp wired into project `.mcp.json` — see `.indusk/planning/local-telemetry/adr.md`
- `rationale_baseline` frontmatter for refactor-baseline plans — see `/lessons/rationale-baseline-frontmatter`
- Doppler extension as the default env layer (replacing composable.env); worktree env auto-provisioning from one service token — see `.indusk/planning/doppler-extension/adr.md`
- Multi-agent coordination: per-agent sections in one current.md + `update_current_section` MCP write surface + worktrees per agent — see `/decisions/multi-agent-coordination`
- Git-only substrate (1.31.0): jj ripped out entirely; parity via deletion; content-keyed dedup handles rebase — see `/decisions/git-only-substrate` (supersedes `/decisions/git-or-jj-substrate`)
- Worktree visibility: worktree-per-plan default + live worktree/branch columns + collision flag; kickoff is a nudge, not a gate — see `/decisions/worktree-visibility`
- Workbench setup one-shot (`indusk setup`) — see `.indusk/planning/archive/workbench-setup-command/`
- Dawn hook parity: invariants + eval rail in the thin lane — loop-owned per-item commits, pending-eval queue with external drain, headless `ask`=pause (ask default both lanes), gate-reminder shed — see `.indusk/planning/dawn-hook-parity/adr.md`
- InDusk Makeover (2026-07-23): budgets + decay + removal — 60 KB CLAUDE.md hard budget w/ write-time hook + compaction ritual; Graphiti + CGC removed entirely (highlight→eval→**lessons** rail preserved); current.md sweep + dead-draft auto-archive; catchup diet ≤15k; MCP keep-lists (project: indusk/dash0/posthog/jaeger — jaeger critical; global: playwright only); hub push/pull at catchup cadence. Supersedes context-budget; rejects Graphiti-as-canonical-store, CGC-with-hygiene, discipline-only compression, load-time truncation. — see `.indusk/planning/indusk-makeover/adr.md`

## Known Gotchas

- Tailwind 4 requires Node 22 ("Cannot find native binding" on 18). OTel auto-instrumentation must load before other imports (`node --import` / Next instrumentation hook).
- Skill files are `SKILL.md` (caps). Skills and hooks are package-owned: edit `apps/indusk-mcp/skills/` + `apps/indusk-mcp/hooks/`, resync installed copies (`skill-sync-parity` test pins byte-equality; dusk has no global `indusk update`).
- Biome 2.x API differs from docs: no `noVar`, overrides use `includes`. Match schema to installed version.
- `validate-impl-structure.js` re-validates the whole file when an edit's `new_string` contains a phase header (the regex matches `#### Phase` too) — scope edits to checklist items to limit re-validation. Trajectory hook JS ports (`check-gates`/`gate-reminder`/`validate-impl-structure`) are minimal mirrors of `apps/indusk-mcp/src/lib/trajectory/` — change TS + every JS port together.
- Trajectory phase refs are numeric only (`Phase N`); `Writable ≤ Passes` enforced at write time. Falsification log fields are single-line (library rejects line separators). Frontmatter regexes for value-bearing keys must be line-anchored (the `rationale_baseline` lesson).
- **Never predict Edit results with `String.replace`** — its replacement-string `$`-substitution (`$$`/`$&`/`` $` ``/`$'`) diverges from the Edit tool's literal semantics; use an index-splice (the claude-md-budget A16 lesson). Guard empty `old_string` before predicting.
- **Hooks discovery is globSync on BOTH sides** (init + update) — a hardcoded hook list silently ships settings registration without the file (the eval-trigger lesson). New hooks also need a targeted settings-ensure block in update.ts for pre-existing projects (eval-trigger + claude-md-budget precedents).
- commander@13 silently drops duplicate parent+subcommand options — declare flags on the parent only, read via `optsWithGlobals()`.
- gray-matter on malformed YAML throws in plain Node but returns `data: {}` inside vitest — detect malformed structurally, don't rely on throwing.
- **The admin sidebar tree is derived entirely from declarations** — top-level means unclaimed, not a reader bug; grouping lives in `PlanList.buildGroups` (the reader stays pure data); subplan children resolve against active+archived with active winning, identically in sidebar and detail; parents render additively via `ParentPlanView` (master prose + cards, then any real sections), doc-less plans header-only. Badge maps: `ui/badge-variant.ts`; research reads: `lib/research-reader.ts`. A browser test must mock every export the component imports, from the module it actually imports from. — see `/reference/admin-ui/overview` + `/reference/admin-ui/component-conventions`
- `next/link` needs a `vi.mock` stub in vitest browser tests (synchronous factory). Admin UI: `dynamic = "force-dynamic"` in root layout is load-bearing; markdown renders only through the `<Markdown>` wrapper (swap libraries in `Markdown.tsx` alone); registry (`~/.indusk/projects.json`) is never auto-pruned — malformed files quarantine to `.corrupt.{ISO}.bak`, never silently overwrite; daemon identity = PID liveness AND port-listening (PID reuse false-positives otherwise); scorecard-to-plan join is date-range approximate.
- Jaeger v2 IS an OTel Collector distribution (one binary for traces); self-metrics disabled via `service.telemetry.metrics.level: none` (port 8888 bind races on restart cycles otherwise). Telemetry binaries ship as platform-split optionalDependencies; bump via `packages/telemetry-binaries-shared/UPSTREAM.json` + `scripts/build-telemetry-binaries.sh`. Telemetry registry stores realpath-normalized paths (macOS `/var` ↔ `/private/var`).
- `extensionsDisable` fires `on_disable` BEFORE renaming the manifest dir (order is load-bearing); `INDUSK_BIN` env overrides the bare `indusk` prefix in extension-hook commands (test-critical).
- **Eval rail invariants** (hard-won — see `.indusk/planning/archive/eval-agent-mcp-access/`): the resume prompt must include Step 4 (highlights) — shrinking it silently starved the queue for 197 evals; `markProcessed` rejects duplicates at write time (`already_processed: true` → STOP, don't re-materialize); `--mcp-config` + `bypassPermissions` literals are pinned by regression test; never use backwards-anchoring phrasing ("as before") in the resume prompt. Post-makeover: materialization writes lessons via `add_lesson`; a reappearing `graph_capture` reference is a test failure. **Old persistent eval sessions pinned to deprecated models 404 on resume — recovery: delete the session state so a fresh spawn picks the current model** (found during A8, 2026-07-23).
- `indusk agent register/list/prune/sweep` and the MCP write tool all take the current.md file lock; `agent list` heartbeat never wipes worktree/branch on non-git cwds. Malformed `Last updated` timestamps are KEPT everywhere (prune, sweep) — never destroy data on bad input.
- The eval hook only fires inside Claude Code sessions (PostToolUse), needs `claude` in PATH; check `.indusk/eval/results.log` + `system.log` when scorecards go missing.
- **The cleanup lib throws on non-git roots** (a workbench root is deliberately not a git repo — silent-`[]` made the ritual vacuous there); its changed-files diff resolves merge bases through candidate fallbacks (`origin/main` → `main` → `master` → root); `isNew` uses `git cat-file -e` exit codes, not the output-swallowing `git()` helper; `.indusk/` is excluded from flagging; ritual-phase terminality needs ≥1 checklist item and sees nested unchecked items.
- `indusk setup` guard is config-aware (real workbench → "run update"; foreign dir → "remove it"); failed setup rmSyncs only what it created (symlink-safe). Worktree extension: `apply_commits[]` is upstream-file-overlay via skip-worktree, NOT cherry-pick; preflight env contract is `CHANGED_FILES` + declarative `preflight_env{}` globs (`set -u` — read undeclared keys with `${VAR:-}`); per-worktree state lives under the gitdir (`indusk-overlay-state.json`), not the working tree.
- `.indusk/graph/semantic-graph.log` still exists on disk in old projects but nothing reads or writes it post-makeover; safe to delete manually.
- **`indusk run`'s gate covers tool surfaces, not intentions** — any tool that can mutate files must be routed through the `{tool_name, tool_input, cwd}` envelope or it is a hole in Tier-1 by construction (falsification found `bash` rewriting checkboxes the `edit` gate would refuse; it is now snapshot-gated + reverted, and escape-scanned best-effort — NOT sandboxed). The invoker fails **loud**: exit 2, any other non-zero, and a timeout kill all block, because an unattended loop must never read silence as permission. — see `/reference/cli/run`

## Current State

**Version**: indusk-mcp 1.33.1 (indusk-makeover — budgets + decay + Graphiti/CGC removal + hub sync). 1.33.0 is a deprecated accidental publish of 1.32.0-era code.

**In flight:**

- **indusk-makeover (this plan, Phases 0–6)** — budgets + decay + Graphiti/CGC removal + catchup diet + hub sync + this-repo migration. Baseline → now: CLAUDE.md 144 KB → ≤60 KB, catchup ~55k → ~8.2k tokens measured, dead drafts archived, MCP keep-lists applied, indusk-infra container stopped. Numero-workbench runs its consuming-side migration from its own plan copy after publish. See `.indusk/planning/indusk-makeover/` (+ `baseline.md` for the before/after numbers).
- **cleanup-ritual (2026-07-13, pending 1.32.0 publish)** — `/cleanup` ritual + config block + Ritual Gate + A-prefixed trajectory IDs. See [archive](.indusk/planning/archive/cleanup-ritual/).
- **worktree-visibility (unpublished)** — worktree-per-plan default + observable bulletin; T7–T9 manual smokes unrun. See [archive](.indusk/planning/archive/worktree-visibility/).
- **indusk-worktree-extension** — shipped + verified; awaits publish + `/falsify` + `/retrospective` before archive. See `.indusk/planning/indusk-worktree-extension/`.
- **workbench-mode-rail-integrity** — Phases 1–4 + falsification shipped (1.31.7–1.31.10); awaiting Numero auto-rail verification before close. See `.indusk/planning/workbench-mode-rail-integrity/`.
- **dawn-external-orchestrator (2026-08-03, unpublished)** — `indusk run`/`atdawn`: model-agnostic gated execution loop, gates ported unchanged, 9-cell acceptance matrix, A8 signed off (flash-for-mechanical routing). See [archive](.indusk/planning/archive/dawn-external-orchestrator/) for full detail.
- **dawn-ui-plan-grouping (2026-08-03, unpublished)** — plan hierarchy in the admin UI: top-down frontmatter declarations, grouped sidebar + parent detail cards, five falsification fixes, cleanup decomposition. See [archive](.indusk/planning/archive/dawn-ui-plan-grouping/) for full detail.

**Active plans** (dead drafts archived 2026-07-23 by the makeover backfill; sidebar order canonical from `.indusk/planning/master.md`):

| Plan | Stage | Next Step |
|------|-------|-----------|
| indusk-makeover | impl in-progress (P6) | finish migration, falsify, cleanup, retrospective |
| versioned-workbench | brief accepted | revisit post-makeover (semantic-graph piece dropped), then test plan |
| hermes-inspired-improvements | brief accepted | ADR |
| doppler-extension | impl (phases landing) | continue phases |
| local-telemetry | test-plan accepted | impl phases |
| documentation-phase-gate / falsify-phase-authoring / evaluator-structured-scorecard-output / admin-ui-local-domain | accepted | queued |
| indusk-v2-dawn | parent plan (living master) | re-founded 2026-07-26; component status in `.indusk/planning/indusk-v2-dawn/master.md`; Component 0 (dawn-ui-plan-grouping) shipped |
| graph-knowledge-architecture / cursor-support / midnight | research/parked | **review against the makeover** — the graph-canonical direction is rejected; these need re-scoping or archiving |
| react-native-support | impl approved, parked | roll into dusk-v2 or archive |

**Test bed**: `~/code/sandbox/chitin-sportsbook` (real project on Base Sepolia) exercises the dev system end-to-end.
