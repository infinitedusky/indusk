---
title: "Dawn — Research Alt: Workbench Mode"
date: 2026-04-30
status: alternate-direction
kind: research-alt
---

# Dawn — Research Alt: Workbench Mode

> **Status:** Alternate option to research. Surfaces a usage pattern observed in real consulting work (Forward Deployed Engineer at a software services firm) and proposes Dawn extend its existing decisions to support it as a first-class mode. Not a recommendation to adopt — a recommendation to evaluate.

## TL;DR

Make the location of Dawn's source-of-truth (skills, plans, lessons, claims, MCP config) configurable. Today it lives inside the project being managed. Allow it instead to live in a **workbench directory** that sits alongside one or more managed projects. "Project-local" becomes the special case where workbench root = project root. Same architecture, one configurable variable.

This unification has a structural blocker in Claude Code today (the gotcha at the bottom of this doc) — addressing that is the load-bearing prerequisite.

## Origin: the actual usage pattern

A Forward Deployed Engineer (FDE) joins a client engagement (Avoca, an AI customer-care platform; specific client onboarding for an auto-service vertical called AutoOps). The FDE needs a place to:

- Take notes on the client codebase as they learn it (private, not committed to client repo)
- Build inspection tools (e.g., a small dashboard that calls the client's APIs to view live state) — needed for testing and exploration, not for shipping
- Render the client's API surface for reference (OpenAPI viewers, etc.)
- Build small demos for the client at delivery time
- Track plans, lessons, decisions across the engagement
- Have all of this work feed into Dawn's claim/evidence model — but for the FDE's work on the client, not for the client codebase itself

Evolution of the structure:

```
~/code/lazer/avoca/                 ← parent dir, opened in IDE for navigation
├── .claude/skills/                 ← shared org skills (cloned from a skills repo)
├── avoca-next/                     ← client repo — pristine, no FDE pollution
├── vapi/                           ← client companion repo
└── dawn-fde-toolkit/               ← personal workbench
    ├── .indusk/                    ← Dawn state for FDE work
    ├── .claude/                    ← Skills, hooks, handoff for FDE work
    ├── .mcp.json                   ← MCPs needed for FDE work
    ├── apps/
    │   ├── docs/                   ← VitePress: notes, ADRs, API reference
    │   └── dashboard/              ← Next.js: client API explorer
    ├── env/                        ← composable.env contracts + components
    ├── docker-compose.yml          ← generated
    └── ce.json                     ← composable.env profiles (local/staging/prod)
```

The FDE opens the IDE/Claude at the parent dir to navigate across all repos. Their work — including all Dawn state — happens in `dawn-fde-toolkit/`. The client repos stay untouched.

## The unification insight

There's no architectural difference between this layout and "Dawn lives in the project." The only variable is **where the workbench root sits**:

- **Project-local mode** (today's default): workbench root = project root. Dawn's `.indusk/`, `.claude/`, `.mcp.json` live inside the project. The project's `apps/` are managed apps.
- **Workbench mode** (new): workbench root is a separate dir. Managed projects are siblings (or worktrees of). The workbench may contain its own `apps/` (docs, demos, internal tools).

Same code, same scaffolding, same skills, same hooks. One config: where is "here."

This dovetails with existing Dawn decisions:

- **A7 (adapter-extension boundary)** — adapters translate between Dawn's claim/evidence protocol and external tools. In workbench mode, the managed project itself becomes an adapter target — Dawn projects state into it (tests, OTel, instrumentation) when needed, but the source of truth stays in the workbench.
- **A8 (agent-neutral skills + projection)** — already says `.claude/` is derived state regenerated from `.dawn/skills/`. In workbench mode, that same projection logic extends across the workbench/project boundary: projecting skills, hooks, claims into a sibling dir is the same pattern as projecting them into the cwd.
- **K6 (coexistence with v1)** — unchanged. Both modes coexist with v1.
- **K5 (build in `apps/dawn/`)** — Dawn itself is a Dawn project. In workbench mode, the indusk monorepo could be a workbench, with `apps/dawn/` as a managed sub-project. Dogfood at the structural level.

## Petal viability under workbench mode

Most of Dawn's "petals" (tests, OTel, planning, lessons, skills, claims, knowledge graph) work cleanly in workbench mode. Some need projection mechanics:

| Petal | Workbench-native? | Notes |
|-------|-------------------|-------|
| Lessons, skills, plans, claims | ✅ pure overlay | Lives in workbench, never touches project |
| Knowledge graph (Graphiti, etc.) | ✅ pure overlay | Workbench-scoped graph + global graph |
| Tests | 🟡 projection | Authored in workbench; projected into project's test runner via adapter (or run via CLI from workbench against project source) |
| OTel instrumentation | 🟡 projection at PR time | Authored in workbench overlay; projected into project's `instrumentation.ts` only when ready to commit/ship. `pr-clean` pattern generalizes. |
| Codebase-native code | n/a | The actual feature code lives in the project. Dawn captures intent and observation about it — already what the claim/evidence model does. |

## Product framing (worth weighing)

The "invisible to the team" property has real go-to-market significance:

- New consultant joins a team using minimal disruption — no install required for the team
- Produces visibly excellent work because the workbench gives them rich context, claim correlation, lesson recall, and observation
- Trust builds; the consultant can later choose when to surface the system to the team
- Most dev tools require team buy-in before showing value; Dawn's workbench mode lets the consultant show value first, then convert

For Lazer-style FDE engagements (the originating case), this is load-bearing. For solo developers on personal projects, project-local mode stays simpler. Both serve real users.

## What's open / decisions surfaced

- **Mode flag** — explicit `workbench: true` in `dawn.config.json`, or implicit by structure (presence of managed projects as siblings)?
- **Per-project overlay file shape** — sibling project may want a thin opt-in marker (`.dawn-managed.json`) to declare it's part of a workbench's scope?
- **Worktrees as first-class** — workbench manages git worktrees of client repos as the unit of change?
- **Composition rules** — what happens if a managed project also has its own `.dawn/`? Merge? Override? Error?
- **CLI ergonomics** — `dawn workbench init`, `dawn workbench add-project <path>`, etc.?

## 🔴 Gotcha — load-bearing prerequisite

Claude Code resolves `.mcp.json` (and `.claude/skills/`, `.claude/hooks/`) only from cwd at session launch. There is no composition with parent dirs, sibling repos, or any "workbench root" concept. So the moment you launch Claude from outside the workbench dir (e.g., from the parent dir to navigate across client repos), every workbench-registered MCP becomes invisible — including the InDusk MCP itself. `check_health`, `get_context`, `list_lessons`, `list_plans`, the graph tools: gone. The skills are also unloaded.

User-global scope (`~/.claude.json`) is a workaround for project-agnostic MCPs (chrome-devtools), but project-specific MCPs (a per-workbench InDusk, custom domain MCPs) can't go there without leaking workbench identity into global state.

This is structural, not configurable. Workbench mode is a broken abstraction without it.

**Required:** an environment-level "workbench root" pointer — `CLAUDE_WORKBENCH` env var, launch flag, or convention — that contributes `.mcp.json`, skills, and hooks to the session **in addition to** whatever the cwd has. Composition, not replacement. Without this, every workbench has to choose between (a) forcing `cd` into it before launch (kills cross-repo navigation), (b) dumping itself into user-global config (kills workbench isolation), or (c) not actually working as intended.

If this prerequisite isn't realistic to push upstream into Claude Code, an InDusk-side workaround might be a launcher script (`dawn shell`) that resolves the workbench, sets `CLAUDE_WORKBENCH`, and exec's into Claude with the right cwd — but the upstream fix is cleaner.

## Adjacent feedback (smaller items observed during the same exploration)

These came up during the engagement that built the originating workbench. They're separate from the workbench-mode question but worth bundling because they came from the same user's session:

- `init-docs` scaffolds `Dockerfile.vitepressdev` (turbo-based, no caddy) — should be composable.env's concern, not InDusk's. Currently causes a conflict: composable.env defers to existing files and skips its own Caddy-aware scaffold.
- composable.env's `init --scaffold docker` doesn't enumerate per-app `package.json` files in the generated Dockerfiles — pnpm install can't resolve workspace packages, deps don't install. Composable.env knows about apps via contracts; it should auto-enumerate from there.
- `env/.env.secrets.shared` is git-tracked by default with a header that says "safe to commit (encrypted via vault)" — but a plaintext value placed in there before encryption leaks. Should default to gitignored, opt-in to commit only after `ce vault set` confirms encryption.
- `vitepress-openapi` as a default scaffold addition for `init-docs` — when an FDE is integrating against a client's API, having a turn-key OpenAPI viewer is high-value. Includes the `specs/openapi/` location convention (because Vite blocks imports from `public/`, which the vitepress-openapi docs example incorrectly uses).
- OrbStack 502 caching ([orbstack/orbstack#1414](https://github.com/orbstack/orbstack/issues/1414), [#2267](https://github.com/orbstack/orbstack/issues/2267), [#617](https://github.com/orbstack/orbstack/issues/617)) — known upstream issue worth a one-line lesson in InDusk's local-telemetry/composable.env skill so the next person doesn't burn time on it.
- Caddy install duplicated across each Dockerfile scaffolded by composable.env — opportunity to factor into a base image. Low priority; the duplication is small.
