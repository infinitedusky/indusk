---
title: "Dusk v2 — Greenfield Rewrite of indusk-mcp"
date: 2026-04-07
status: in-progress
---

# Dusk v2 — Research

## Question

Rewrite `@infinitedusky/indusk-mcp` as `@infinitedusky/dusk` with a clean architecture: config-driven everything, scaffold/init separation, unified extension model, OTel-as-extension. Build in a sibling directory (`apps/dusk/`) so v1 stays installable while v2 develops in parallel. Migrate infinitedusky itself when v2 is ready.

This research drives the decisions one at a time. Each decision unblocks the next. We don't write the brief until every decision is made and recorded here.

## Goals

- **Unified extension model** — built-in and third-party extensions look identical to users
- **Config as source of truth** — `.indusk/config.json` declares what the project uses; init reconciles
- **Scaffold/init separation** — scaffold makes decisions interactively, init installs deterministically
- **Smaller surface area** — delete cruft, avoid speculative abstractions
- **OTel-as-extension** — opt-in, gate-contributing, RN guidance lives inside it
- **Clean break, no backwards compat** — migrate via one-shot script, not by carrying both shapes

## Non-Goals

- Backwards compatibility with v1 file structure or APIs
- Continuing to publish v1 (it freezes at its current version)
- Migrating other people's projects (only infinitedusky exists)
- A pluggable hook/extension runtime beyond what's actually needed

---

## Decision Sequence

These are the questions we need to answer, in order. Each is a separate discussion. The next question can't be meaningfully answered until the previous one is settled.

### 1. Built-in extension storage [unanswered]

Where do built-in extensions live, and how does the system find them?

**Option A — Ship in package, copy on scaffold:**
- `dusk` npm package contains `extensions/{name}/manifest.json`
- During scaffold, selected extensions are copied to `.indusk/extensions/{name}/`
- Built-in and third-party become indistinguishable on disk

**Option B — Ship in package, reference by name:**
- `dusk` npm package contains `extensions/{name}/`
- `.indusk/config.json` lists enabled extensions by name
- Built-ins resolved against package, third-party extensions live in `.indusk/extensions/`
- Two storage locations, one config

**Option C — Hybrid:**
- Built-ins ship in package and stay there (read-only)
- `.indusk/extensions/` only holds third-party
- Manifests can be overridden locally if needed (rare)

**To decide:** Which model? Why?

**Status:** unanswered

---

### 2. Config schema shape [blocked on #1]

What goes in `.indusk/config.json`? What's the minimum viable shape?

Candidate fields:
- `version` — schema version (forward compat)
- `mode` — `full` | `local`
- `extensions` — `["otel", "cgc", "graphiti"]` (or richer object form?)
- `verify` — linter, test runner, type check tools
- `project` — name, type preset (next-app, node-cli, python-lib, react-native)?

**To decide:** Final schema shape with examples for normal mode and local mode.

**Status:** blocked on #1 (extension representation depends on storage decision)

---

### 3. Extension manifest schema [blocked on #1]

What does an extension manifest declare? Minimum viable shape, no speculative fields.

Candidates:
- `name`, `version`, `description`
- `skills` — list of skill files this extension installs
- `env_files` — `.env` files needed (scaffolded into `.indusk/extensions/{name}/env/`)
- `templates` — files to scaffold into the project (e.g. OTel `instrumentation.ts`)
- `gates` — gates this extension contributes to plans (e.g. `otel`)
- `on_init`, `on_update`, `on_scaffold` — lifecycle hooks (bash strings? TS modules?)
- `mcp_server` — MCP server registration data
- `dependencies` — other extensions this depends on
- `setup_instructions` — printed after install

**To decide:** Which fields make the cut for v2.0. What gets cut.

**Status:** blocked on #1

---

### 4. Gate contribution model [blocked on #3]

How do extensions plug into the plan parser's gate enforcement?

Currently the parser hardcodes 5 gate types: implementation, otel, verify, context, document.

**Option A — Core gates + extension gates:**
- Core gates always present: implementation, verify, context, document
- Extensions can declare additional gates (e.g. otel extension adds `otel` gate)
- Plan parser queries enabled extensions for gate definitions
- Gate sections in impl markdown follow `#### Phase N {GateName}` convention

**Option B — All gates extension-defined:**
- No core gates. Even verify/context/document become extensions
- Maximum flexibility, more complexity

**Option C — Core gates fixed, no extension gates:**
- 4 fixed core gates. OTel becomes part of implementation gate (in code review, not separate)
- Simplest, but loses the OTel-specific enforcement

**To decide:** Which gate model? How does the impl parser discover extension gates?

**Status:** blocked on #3

---

### 5. Scaffold flow [blocked on #2, #3]

What does `dusk scaffold` actually do?

Sub-questions:
- Interactive prompts? Or flag-driven? Or both?
- What questions does it ask? (mode, extensions, project type, ...)
- Are there project-type presets that pre-select extensions?
- Does it auto-detect existing tooling (linter, test runner, etc.)?
- Does scaffold automatically chain into init, or are they fully separate commands?
- What if you re-run scaffold on an existing project? (re-prompt? respect existing config?)

**To decide:** Concrete scaffold UX and command flow.

**Status:** blocked on #2, #3

---

### 6. Init reconciliation behavior [blocked on #5]

How does `dusk init` behave given a `.indusk/config.json`?

Sub-questions:
- Pure idempotent reconciliation (no surprises, no decisions)?
- Does init ever prompt? (probably not — scaffold is for prompts)
- How does init handle drift (file changed since last init)?
- What does init log? Same as v1's section-by-section output?
- What's the relationship to `dusk update` (still needed? merged in?)

**To decide:** Init's exact responsibilities and behavior.

**Status:** blocked on #5

---

### 7. Local mode rethink [unblocked, can run in parallel]

Local mode currently uses an "overlay" system to layer InDusk additions onto the team's `.claude/settings.json`, then strip them via `pr-clean` before PRs.

Sub-questions:
- Is the overlay model the right answer or a workaround?
- Could a single `.indusk/settings-additions.json` plus a hook that merges at session start work better?
- Or does Claude Code now support per-directory settings inheritance that makes this trivial?
- What's the v2 version of local mode?

**To decide:** Local mode architecture for v2.

**Status:** unanswered (not blocked, but lower priority — can wait)

---

### 8. Plan parser refactor [blocked on #4]

The current `plan-parser.ts` is hand-rolled markdown parsing with hardcoded gate names. With extension-contributed gates (decision #4), how does it work?

Sub-questions:
- Can we keep the markdown checklist format unchanged?
- How does the parser discover which gates to enforce for a given plan?
- Is there a per-plan gate spec, or is it always derived from enabled extensions?
- Tests — what's the testing strategy for an extension-aware parser?

**To decide:** Parser architecture, test strategy.

**Status:** blocked on #4

---

### 9. OTel as extension — concrete plan [blocked on #3, #4]

Once we have the manifest schema and gate model, what does the OTel extension look like in detail?

Sub-questions:
- What templates does it scaffold? (`instrumentation.ts`, `instrumentation.tsx` for RN, `filtering-exporter.ts`, `logger.ts`, Python `instrumentation.py`)
- Does it auto-detect runtime (Node.js / Next.js / Python / RN) and scaffold the right templates, or ask?
- How does the React Native variant fit in? (sub-template? flag? auto-detect Expo/RN?)
- What gate does it contribute? (`otel`)
- What MCP server (if any)? — probably none, OTel observability is via Dash0 extension

**To decide:** Final shape of the OTel extension as the v2 reference implementation.

**Status:** blocked on #3, #4

---

### 10. What gets rewritten vs copied [blocked on most decisions]

Inventory of what stays as-is from v1 vs what gets rewritten.

Likely **copy as-is:**
- Skills (markdown files)
- Lessons (markdown files)
- Hooks (already small JS files)
- Templates (CLAUDE.md, OTel instrumentation files, etc.)

Likely **rewrite:**
- CLI entry point and command structure
- `init.ts` (replaced by scaffold + init pair)
- `plan-parser.ts` (extension-aware)
- `extension-loader.ts` (unified storage)
- `settings-overlay.ts` (probably gone or rebuilt)
- `config.ts` (new schema)
- MCP tool implementations (audit each one)

**To decide:** Final inventory. What's frozen, what's rewritten, what's deleted entirely.

**Status:** blocked on most decisions

---

### 11. Migration script design [blocked on everything]

`dusk migrate` reads v1 layout and writes v2 layout.

Sub-questions:
- What v1 state does it read? (`.indusk/config.json`, `.claude/skills/`, `.indusk/extensions/`, ...)
- What v2 state does it write?
- What does it delete vs leave alone?
- One-shot or idempotent?
- Does it run on the current Claude Code session, or as a CLI step?

**To decide:** Migration script behavior.

**Status:** blocked on everything else

---

### 12. Build location and release sequence [unblocked, can decide early]

- Build v2 in `apps/dusk/` (sibling to `apps/indusk-mcp/`)
- v1 stays installable globally throughout v2 development
- v2 publishes when complete; v1 freezes
- Migration runs once per project; infinitedusky is the first migration

**To decide:** Anything to add or change about this sequence.

**Status:** essentially decided, just confirm.

---

## Open Questions (broader)

- Should `dusk` keep the "MCP server" framing or position itself as a dev system that includes an MCP server?
- Is the indusk-docs site part of v2 or a separate concern?
- Are there v2 features worth building that we haven't talked about yet (e.g. plan dashboard, lesson auto-suggest)? Or strictly refactor scope?

## Sources

- Conversation 2026-04-06 — original direction discussion
- `apps/indusk-mcp/src/bin/commands/init.ts` — current init complexity (~860 lines)
- `apps/indusk-mcp/src/lib/plan-parser.ts` — current hardcoded gate parsing
- `apps/indusk-mcp/src/lib/settings-overlay.ts` — current local mode mechanism
- `apps/indusk-mcp/extensions/` — current built-in extension layout
- `.indusk/extensions/` — current third-party extension layout (and where graphiti currently lives)
- `.indusk/planning/local-init-mode/` — recent context on local mode design
- `research/indusk-product-direction.md` — product framing
