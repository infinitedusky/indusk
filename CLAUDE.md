@AGENTS.md

# dusk — Project Context

## What This Is

A pnpm + Turborepo monorepo containing the InDusk development system. The repo dogfoods its own skill system — the same plan/work/verify/claude-md skills used to build features are also the product being showcased.

## Architecture

```
dusk/
├── apps/
│   ├── indusk-mcp/        # InDusk MCP server — CLI, skills, hooks, lessons, extensions (its CLAUDE.md: package rules; hooks/CLAUDE.md: hook rules)
│   ├── indusk-admin/      # Next.js read-only admin UI (daemon via `indusk ui`; its CLAUDE.md: app rules)
│   └── docs/              # VitePress docs site (guide / reference / decisions / lessons)
├── packages/              # telemetry-binaries-* — platform-split jaeger + otelcol
├── .claude/skills/        # Installed skills — package-owned, synced from apps/indusk-mcp/skills/
├── .claude/lessons/       # Lessons registry — titles are the rules; a guarded one reaches you from its enforcer
├── docker/                # Dockerfiles (always-on image)
├── biome.json             # Quality ratchet — see biome-rationale.md for per-rule why
├── vitest.config.ts       # Workspace projects; apps inherit via extends
├── .indusk/               # InDusk home — planning/ (+ shipped CLAUDE.md: the planning rules), extensions/, config.json, current.md
└── CLAUDE.md              # Root: design intent only; area rules in nested CLAUDE.md files
```

**Apps:**

- **indusk-mcp** — the InDusk MCP server + CLI (`init`/`update`/`setup`/`extensions`/`agent`/`plans`/`sync`/`context`/`eval`/`ui`/`telemetry`/`worktree`/`promises`/`papers`/`workbench`), published as `@infinitedusky/indusk-mcp`. Skills (`skills/*.md`), hooks (`hooks/*.js`) and the planning context file (`templates/planning/CLAUDE.md`) are package-owned and installed into projects by `init`/`update`. It also hosts the two Dawn commands: `indusk run <plan>` (a model-agnostic gated loop over a plan's phases) and `indusk verify <plan> --phase N` (phase-boundary verification for work Dawn did not execute; detects, never repairs). Git is the only SCM. — see `/reference/cli/run`, `/reference/cli/verify`
- **indusk-admin** — Next.js read-only viewer over `.indusk/planning/` + `.indusk/eval/`, one machine-global daemon (`indusk ui`), reusing indusk-mcp's parsers through workspace subpath exports — never duplicating parsing. — see `/decisions/admin-ui-hosting`
- **docs** — VitePress site. Every plan contributes pages at close; ADRs publish to `/decisions/*`.

**Context tiers** — a rule reaches you where and when it applies. This file holds design intent and orientation only. A rule a test or hook enforces is delivered by that enforcer: its failure message names the lesson (`lesson: <name>` → `.claude/lessons/<name>.md`), and `list_lessons` reports each lesson **guarded** or **advisory**, derived on every read. A rule relevant in one area lives in that area's `CLAUDE.md` (`.indusk/planning/` — package-owned and shipped; `apps/indusk-admin/`; `apps/indusk-mcp/`; `apps/indusk-mcp/hooks/`), loaded when a file there is read. Operational state lives in `.indusk/current.md`. A new rule goes to the enforcer first, a directory second, here last and with a reason. — see `/guide/context-tiers`

**MCP servers** (project `.mcp.json` keep-list): **indusk** (dev-system tools), **jaeger** (the local-telemetry daemon's MCP — the promise loop's only backend, local and deployed), **posthog**; dash0 is disabled here (an optional query surface, never a loop dependency). Global keep-list: **playwright** only. Graphiti and codegraphcontext are retired. — see `.indusk/planning/archive/indusk-makeover/adr.md`

**Skills** (process): planner, work, verify, claude-md, document, retrospective, catchup, handoff, falsify, cleanup, highlight, rail-check, git, eval-review, toolbelt, write (prose only, no gates). Each concept has one canonical skill; edit in `apps/indusk-mcp/skills/`, never `.claude/skills/` directly.

**Agent roles** (three tiers): the **working agent** does the user's task and flags moments via `mcp__indusk__highlight`; the **eval agent** (background, on `git commit` + session end) scores work and materializes durable highlights into **lessons** via `add_lesson`; **infrastructure** (hooks, CLI, validators) enforces invariants. The working agent never materializes highlights itself. — see `.indusk/planning/archive/agent-roles/adr.md`

## Conventions

- pnpm workspaces + Turborepo; **Node 22 required** (Tailwind 4 native bindings).
- **Biome, not ESLint** — `pnpm check` / `pnpm check:fix` / `pnpm format`. Biome config is a knowledge artifact (`biome-rationale.md`); the ratchet only tightens.
- `pnpm test`: parallel, never starts a server or daemon (`INDUSK_SKIP_TELEMETRY_AUTOSTART`); it and `test:system` end failing on one left in a temp home, pass or fail. `test:system`: each package's `vitest.tiers.ts` files, at landing and by `pnpm release`. **E2e**: `pnpm e2e` (needs `claude` + a daemon) — promise loop, always-on server, nested-context probe; run at the close of a plan touching a `CLAUDE.md`.
- **Every `CLAUDE.md` has a hard write-time budget** — `claude-md-budget.js` refuses growth past `context.claude_md_budget_bytes` (18432 here; reason in `.indusk/config.json`); shrinking is always allowed; nested files: `nested_claude_md_budget_bytes` (16384). Entries are rule + pointer; growth past it means a rule belongs at a lower tier. `indusk context check-pointers` verifies every pointer and lesson token in every context file and refuses hand-copied `**Version**:` claims. — see `/guide/context-budget`
- **An unrecorded promise violation outranks the roadmap** when answering "what's next"; unreachable telemetry is said, never reported as a zero. — see `/reference/skills/catchup`
- **`.indusk/current.md` is the operational layer**: a `## Project (shared)` region any agent may edit (what is in flight, blockers, what is next) plus per-agent `## Session <short> — <task>` sections, each written only by its own session via `mcp__indusk__update_current_section` (typically at `/handoff`); commit like any file. `merge=union` merges concurrent appends; every mutation goes through the `current.md.lock` file lock. — see `/decisions/multi-agent-coordination`
- Plans live in `.indusk/planning/{kebab-case}/`; use `/planner` before implementing — don't jump to code. The planning rules load with the plan documents.
- **Releases: bump on main, after the branch is merged — it is the retrospective's Step 11**, not a thing to remember. `pnpm publish` packs the working tree, so a publish from clean main is blind to every `plan/*` worktree; `pnpm release` enforces the guard. **Before saying whether a publish is current**, read `git rev-list <release-commit>..HEAD` and `git for-each-ref refs/heads/plan/* --no-merged HEAD`, never a version number. — see `/reference/skills/retrospective`
- Before touching shared code, grep for importers and callers to understand blast radius.

## Key Decisions

- Context skill is pure markdown instructions; CLAUDE.md keeps a fixed five-section structure (six until context-tiers moved Current State out) — see `.indusk/planning/archive/context-skill/adr.md`
- Context tiers: a rule is delivered by its enforcer (`lesson:` tokens), by the directory where the work is written (nested `CLAUDE.md` files, the planning one shipped), or — design intent only — by this file; a register proves no rule was lost; the root is held by a lowered budget — see `/decisions/context-tiers`
- Biome over ESLint; global config is the floor, project extends — see `.indusk/planning/archive/code-quality-system/adr.md`
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
- `rationale_baseline` frontmatter for refactor-baseline plans — see `/lessons/rationale-baseline-frontmatter`
- Doppler extension as the env layer — see `.indusk/planning/archive/doppler-extension/adr.md`
- Multi-agent coordination: per-agent sections in one current.md + `update_current_section` MCP write surface + worktrees per agent — see `/decisions/multi-agent-coordination`
- Git-only substrate (1.31.0): jj ripped out, parity via deletion; `scm-rip-out-grep.test.ts` exempts the record — an audit that fires on its own archive gets switched off — see `/decisions/git-only-substrate`
- Worktree visibility: worktree-per-plan default + live worktree/branch columns + collision flag; kickoff is a nudge, not a gate — see `/decisions/worktree-visibility`
- Workbench setup one-shot (`indusk setup`) — see `.indusk/planning/archive/workbench-setup-command/`
- Dawn hook parity: invariants + eval rail in the thin lane — loop-owned per-item commits, pending-eval queue with external drain, headless `ask`=pause (ask default both lanes), gate-reminder shed — see `/decisions/dawn-hook-parity`
- Test phases as structure: `### Test Phase N` + `### Build Phase N` as two sequences; Test Phase 1 mandatory, first, and the register where every deferral is justified. Zero migration via an optional `Build ` prefix — see `/decisions/test-phase-structure`
- Shape check: per-phase craft review in `/work` (intra-unit) vs `/cleanup` at close (inter-file) — executor behavior, not a gate type (gate vocab is closed in 4 sites and unknown headings fail silently); the executing agent judges against **prose** craft rules the enabled extensions own; findings append as items to the current phase — see `/decisions/lifecycle-rebalance`
- Dawn verify (component 6, the keystone): read-only phase-boundary verification for work Dawn didn't execute — chained ledger baseline, runner-agnostic red-test detection (files + exit codes, never runner-output parsing), scoped to referenced files; reverting deferred to component 7 — see `/decisions/dawn-verify`
- InDusk Makeover (2026-07-23): budgets + decay + removal — the 60 KB budget hook + compaction, Graphiti/CGC removed with the lessons rail kept, current.md sweep + dead-draft archive, catchup diet, MCP keep-lists, hub push/pull. Supersedes context-budget. — see `.indusk/planning/archive/indusk-makeover/adr.md`
- Versioned workbench (1.37.0–1.38.3): the workbench root is a git repo with its own remote and a sync loop; repos declared in `worktree.repos[]` — see `/decisions/versioned-workbench`
- Dawn workbench execution (6.5): one `resolveExecutionRoots` behind run/verify/cleanup; two roots and a commit cadence per repo in the loop; `codeSha` on the ledger and `repo` on queued evals, absence a rule not a migration; multi-repo still refuses — see `/decisions/dawn-workbench-execution`
- Admin UI phase progress: one `lifecycle` module (positions as nouns, activities as verbs, gate stages) read by `parsePlan`, the retrospective gate and the admin; phases keyed `{kind, number}` through progress, Shape and the boundary record (absent kind = build); three tri-state bars live via `router.refresh()`; a plan that adds a stage renders it, pinned — see `/decisions/admin-ui-phase-progress`
- Writing skill: papers are plan documents (`kind: paper`, never inferred); `/write` prose-only; publish commits in the destination, never pushes — see `.indusk/planning/archive/writing-skill/adr.md`
- Promises (Day 4a): one markdown file per promise at the plan root, links as declared paths verified by a `promise: <name>` token, per-kind link rule, four states, domains in config, one `lib/promises/` behind CLI/MCP/admin — see `/decisions/day-promises`
- Monitor (Day 4b): plain-OTel promise mark, no InDusk runtime code; `promises status`/`watch` over local Jaeger; reopen by Maintenance phase; `monitor` from files — see `/decisions/day-monitor`
- Always-on (Day 4b′): the shipped Jaeger as a server (badger + basic auth, Fly reference); an in-process pass announces each violation once to Slack, failure-safe; detect-and-notify only; a project names its Jaeger, absence = local — see `/decisions/day-always-on`; deployed and smoked on Fly — `/decisions/day-always-on-deploy`
- Watcher heartbeat: every promise read first probes its Jaeger (a span sent and read back) and says *watcher blind*, never zero; the server beats each pass and tells Slack once each way — see `/decisions/watcher-heartbeat`
- Promise sources: `local` (the daemon) and `production` (`promises.jaeger`) read side by side, each source's failure its own; production raises the alarm — see `/decisions/promise-sources`
- Promise timeline: compact sliced reads; an admin store that reads only what is new plus a late tail; one `violationState` (unrecorded / open / fixed) for chip and timeline; incidents record `fixed` via `promises fix` — see `/decisions/promise-timeline`
- Test kinds run at their moments; servers in the system tier — see `/decisions/test-kinds`
- Briefs hold expectations and promises; rows say what they prove; a plan closes with its promises confirmed — see `/decisions/planner-promises`

## Known Gotchas

- **A safety argument written in a comment is not enforced by the code around it** — grep for comments asserting an invariant and check the control flow delivers it; two workbench-sync paths each reported the worst case as the most reassuring one. — see `/reference/cli/workbench`
