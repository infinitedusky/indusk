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
│   ├── vscode-extension/  # Editor extension, presentation only (its CLAUDE.md: app rules)
│   └── docs/              # VitePress docs site (guide / reference / decisions / lessons)
├── packages/              # telemetry-binaries-* — platform-split jaeger + otelcol
├── .claude/skills/        # Installed skills — package-owned, synced from apps/indusk-mcp/skills/
├── .claude/lessons/       # Lessons registry — titles are the rules; a guarded one reaches you from its enforcer
├── examples/seat-holds/   # The demo app (`indusk demo`): its own InDusk project
├── docker/                # Dockerfiles (always-on image)
├── biome.json             # Quality ratchet — see biome-rationale.md for per-rule why
├── vitest.config.ts       # Workspace projects; apps inherit via extends
├── .indusk/               # InDusk home — planning/ (+ shipped CLAUDE.md: the planning rules), extensions/, config.json, current.md
└── CLAUDE.md              # Root: design intent only; area rules in nested CLAUDE.md files
```

**Apps:**

- **indusk-mcp** — the InDusk MCP server + CLI (`init`/`update`/`setup`/`extensions`/`agent`/`plans`/`sync`/`context`/`eval`/`ui`/`telemetry`/`worktree`/`promises`/`papers`/`workbench`), published as `@infinitedusky/indusk-mcp`. Skills (`skills/*.md`), hooks (`hooks/*.js`) and the planning context file (`templates/planning/CLAUDE.md`) are package-owned and installed into projects by `init`/`update`. It also hosts the two Dawn commands: `indusk run <plan>` (a model-agnostic gated loop over a plan's phases) and `indusk verify <plan> --phase N` (phase-boundary verification for work Dawn did not execute; detects, never repairs). Git is the only SCM. — see `/reference/cli/run`, `/reference/cli/verify`
- **indusk-admin** — Next.js read-only viewer over `.indusk/planning/` + each project's evaluation results, one machine-global daemon (`indusk ui`) (its parsing rule lives in its CLAUDE.md). — see `/decisions/admin-ui-hosting`
- **vscode-extension** — markers at each promise's line, the Promises panel, Fix with Claude; reads `indusk promises health --json`, writes nothing; ships in the npm package (`indusk editor install`).
- **docs** — VitePress site. Every plan contributes pages at close; ADRs publish to `/decisions/*`.

**Context tiers** — a rule reaches you where and when it applies. This file holds design intent and orientation only. A rule a test or hook enforces is delivered by that enforcer: its failure message names the lesson (`lesson: <name>` → `.claude/lessons/<name>.md`), and `list_lessons` reports each lesson **guarded** or **advisory**, derived on every read. A rule relevant in one area lives in that area's `CLAUDE.md` (`.indusk/planning/` — package-owned and shipped; `apps/indusk-admin/`; `apps/indusk-mcp/`; `apps/indusk-mcp/hooks/`), loaded when a file there is read. Operational state lives in `.indusk/current.md`. A new rule goes to the enforcer first, a directory second, here last and with a reason. — see `/guide/context-tiers`

**MCP servers** (project `.mcp.json` keep-list): **indusk** (dev-system tools), **jaeger** (the local-telemetry daemon's MCP — the promise loop's only backend, local and deployed), **posthog**; dash0 is disabled here (an optional query surface, never a loop dependency). Global keep-list: **playwright** only. Graphiti and codegraphcontext are retired. — see `.indusk/planning/archive/indusk-makeover/adr.md`

**Skills** (process): planner, work, verify, claude-md, document, retrospective, catchup, handoff, falsify, cleanup, audit, highlight, rail-check, git, eval-review, toolbelt, write (prose only, no gates). Each concept has one canonical skill; edit in `apps/indusk-mcp/skills/`, never `.claude/skills/` directly.

**Agent roles** (three tiers): the **working agent** does the user's task and flags moments via `mcp__indusk__highlight`; the **eval agent** (background, on `git commit` + session end) scores work and materializes durable highlights into **lessons** via `add_lesson`; **infrastructure** (hooks, CLI, validators) enforces invariants. The working agent never materializes highlights itself. — see `.indusk/planning/archive/agent-roles/adr.md`

## Conventions

- pnpm workspaces + Turborepo; **Node 22 required** (Tailwind 4 native bindings).
- **Biome, not ESLint** — `pnpm check` / `pnpm check:fix` / `pnpm format`. Biome config is a knowledge artifact (`biome-rationale.md`); the ratchet only tightens.
- `pnpm test`: parallel, never starts a server or daemon (`INDUSK_SKIP_TELEMETRY_AUTOSTART`); it and `test:system` end failing on one left in a temp home, pass or fail. `test:system`: each package's `vitest.tiers.ts` files, at landing and by `pnpm release`. **E2e**: `pnpm e2e` (needs `claude` + a daemon) — promise loop, always-on server, nested-context probe; when it runs is the retrospective's (`/reference/skills/retrospective`).
- **`.indusk/current.md` is the operational layer**: a `## Project (shared)` region any agent may edit (what is in flight, blockers, what is next) plus per-agent `## Session <short> — <task>` sections, each written only by its own session via `mcp__indusk__update_current_section` (typically at `/handoff`); commit like any file. `merge=union` merges concurrent appends; every mutation goes through the `current.md.lock` file lock. — see `/decisions/multi-agent-coordination`
- Plans live in `.indusk/planning/{kebab-case}/`; use `/planner` before implementing — don't jump to code. The planning rules load with the plan documents.

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
- Test phases as structure: `### Test Phase N` + `### Build Phase N` as two sequences; Test Phase 1 mandatory, first, and the register where every deferral is justified. Zero migration via an optional `Build ` prefix — see `/decisions/test-phase-structure`
- Dawn verify (component 6, the keystone): read-only phase-boundary verification for work Dawn didn't execute; detects, never repairs, reads files and exit codes never runner output — see `/decisions/dawn-verify`
- InDusk Makeover (2026-07-23): budgets + decay + removal — the 60 KB budget hook + compaction, Graphiti/CGC removed with the lessons rail kept, current.md sweep + dead-draft archive, catchup diet, MCP keep-lists, hub push/pull. Supersedes context-budget. — see `.indusk/planning/archive/indusk-makeover/adr.md`
- Versioned workbench (1.37.0–1.38.3): the workbench root is a git repo with its own remote and a sync loop; repos declared in `worktree.repos[]` — see `/decisions/versioned-workbench`
- Dawn workbench execution (6.5): one `resolveExecutionRoots` behind run/verify/cleanup; two roots and a commit cadence per repo in the loop; `codeSha` on the ledger and `repo` on queued evals, absence a rule not a migration; multi-repo still refuses — see `/decisions/dawn-workbench-execution`
- Promises (Day 4a): one markdown file per promise at the plan root, links as declared paths verified by a `promise: <name>` token, per-kind link rule, four states, domains in config, one `lib/promises/` behind CLI/MCP/admin — see `/decisions/day-promises`
- Monitor (Day 4b): plain-OTel promise mark, no InDusk runtime code; `promises status`/`watch` over local Jaeger; reopen by Maintenance phase; `monitor` from files — see `/decisions/day-monitor`
- Promise sources: `local` (the daemon) and `production` (`promises.jaeger`) read side by side, each source's failure its own; production raises the alarm — see `/decisions/promise-sources`
- One promise language: upheld/broken, holding/broken live, no signal unknown; every reader takes `broken` and `violated` as broken, writers keep `violated` until `mark-first`; `known-broken` with `known-violated` still read — see `/decisions/one-promise-language`
- A plan runs its tests, what its changes reach and its Must-not-break tests; processes in the system tier — see `/decisions/tests-never-make-us-wait`
- Briefs hold expectations and promises; rows say what they prove; a plan closes with its promises confirmed — see `/decisions/planner-promises`
- Workbench plans: documents at the workbench root, code on `plan/<name>` in the named repo; one contract per repo through one resolver — see `/decisions/workbench-plan-authoring`
- Bookkeeping: notes committed on `main` as written; machine state in `~/.indusk/projects/<id>-<hash>/` (`indusk eval home`); the evaluator's tools named — see `/decisions/bookkeeping-lives-where-it-is-read`
- Workflow steps: `workflow.steps` names what each step runs, facts never logic; dusk's slow tier never blocks landing or release — see `/decisions/release-checks-run-once`
- Server provisioning: every recording server is the person's own — `indusk server connect` for one run anywhere, `server deploy` the one-command Fly path, the image published with each release; no hosted service — see `/decisions/server-provisioning`
- Audit step: a fresh subagent on `workflow.steps.audit.tier` reads the approved impl, the final trajectory and the diff, writes `audit.md`; advisory — see `/decisions/plan-review-subagent`
- UI promises: an app's look is held by mockups a person approves in the cockpit, on one DTCG foundation, no raw values, held by value in Chromium — see `/decisions/ui-promises`
- Brief as the contract: looks in the brief, approval of the brief, an amendment stops the build until a person re-approves, a plan starts as a conversation — see `/decisions/brief-as-the-contract`
- Plan titles and stories: a plan is named by its title (brief or master, else its handle in words) through one rule in the package; a master's page tells its story from `subplan-row`; Needs you counts amendments — see `/decisions/plan-stories`
- Sessions per plan: one per plan and kind, at most `sessions.max` a machine — see `/decisions/sessions-per-plan`
- New project flow: a project starts as a conversation in the admin; drafts at `~/.indusk/new-projects/`, creation by the package — see `/decisions/new-project-flow`
- Plans are promises: a plan holds the promises it lands, each stated as clauses with a clause plan before the ADR; opt-in `clauses: required` — see `/decisions/plans-are-promises`
- The daemon is found, not guessed: one daemon per machine on one stored address (`indusk telemetry address`), never a second; rules in `apps/indusk-mcp/CLAUDE.md` (Promises and telemetry) — see `/decisions/daemon-found-not-guessed`
- Init sets up telemetry: the scaffold goes in each declared code repo, sends to the daemon's stored address with project and environment on every span, and offers a newer template beside an edit — see `/decisions/init-sets-up-telemetry`
- Signals prove a clause beside its tests: a clause is upheld only when its tests pass and its signal has reported in a real run; a break names its clause; no signal reads "no signal" — see `/decisions/mark-first`
- Plan timing: one per-plan log in machine state, written through one never-raising writer, read by `indusk plans time` — see `/decisions/plan-timing`

## Known Gotchas

- Area gotchas live in the area's `CLAUDE.md`, loaded when a file there is read — workbench sync's is in `apps/indusk-mcp/CLAUDE.md` (Workbenches and worktrees).
