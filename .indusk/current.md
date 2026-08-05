# Operational State

This file represents the operational state for the project — what's happening RIGHT NOW. The architectural layer ("what this project is") lives in [`CLAUDE.md`](../CLAUDE.md). The historical layer ("how we got here") lives in `.indusk/planning/` plans + the docs site.

Two regions:

- **`## Project (shared)`** — cross-cutting state any agent can edit. Pre-launch crunch mode, merge freezes, telemetry endpoint changes, anything project-wide.
- **`## Session <short> — <task>`** blocks — per-agent operational state. Each block holds the agent's `### In Flight`, `### Open Questions`, `### Cursor`. Written via `mcp__indusk__update_current_section` at `/handoff` (or any moment something solidifies). Other agents' sections are byte-untouched by your writes.

`/catchup` reads this file pure-read. `/retrospective` distills sections of it into CLAUDE.md on plan close.

## Project (shared)

_Any agent can edit this section. Cross-cutting state that's true for the whole project right now._

(empty)

---

## Session c6257c42 — work indusk-makeover (Phase 0: baseline tripwires)

**Session ID**: c6257c42-ad34-41a2-b090-d161a282c5c3
**Last updated**: 2026-07-24T00:25:31.233Z
**Branch**: plan/indusk-makeover-phase-0
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/indusk-makeover

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 6dd91742 — starting catchup (indusk-makeover worktree)

**Session ID**: 6dd91742-bec6-47ff-86b8-12193abf9407
**Last updated**: 2026-07-24T01:19:10.124Z
**Branch**: plan/indusk-makeover-phase-0
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/indusk-makeover

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 22c42faa — eval agent: scoring commit d7fd01d1 (indusk-makeover P3 close)

**Session ID**: 22c42faa-f26e-4314-8a74-8478a71f2d86
**Last updated**: 2026-07-24T01:20:31.698Z
**Branch**: plan/indusk-makeover-phase-0
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/indusk-makeover

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 80563054 — Dawn v1 — building the model-agnostic external orchestrator

**Session ID**: 80563054-36cb-45db-a2b1-e4f027406a0b
**Last updated**: 2026-07-27T03:34:21.981Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

Dawn v1 kicked off. Foundation: 10 maxims (`.indusk/planning/indusk-v2-dawn/maxims.md`) + a roadmap. First build = `dawn-external-orchestrator` (brief + ADR accepted + impl) — lift InDusk's discipline OUT of Claude Code into a model-agnostic orchestrator (`indusk run <plan> --model claude|gpt|gemini|grok`): rent the Vercel AI SDK loop, reuse the gate scripts as-is, own a thin adapter + a port of the autopilot loop control. The build lives on worktree branch `plan/dawn-external-orchestrator` at `~/code/sandbox/dusk-worktrees/dawn-external-orchestrator` (committed there, NOT on main). **Phase 0 done + green**: `indusk run` subcommand + provider registry + semver guinea-pig fixture + docs stub; T0 passing. Autopilot PAUSED at the Phase 0 to 1 boundary.

### Open Questions

(1) Resume Phases 1-5 fresh vs continue in-session — recommended: fresh session from the worktree (clean orchestrator context per Dawn's own fresh-context principle; this session was very long). (2) Phase 4 second driver: Gemini (default — free tier fits the credit-arbitrage ethos) vs GPT-5 — user picks by available credits. (3) Phase 5 matrix needs a remote box (not yet stood up) and is a human-judgment gate, so it will pause there regardless. (4) The InDusk validator bug found this session wants a real indusk-mcp fix + a lesson (see Cursor).

### Cursor

Resume by running `/work --autopilot dawn-external-orchestrator` FROM the worktree `~/code/sandbox/dusk-worktrees/dawn-external-orchestrator` — it picks up at Phase 1 (Rent the loop: add `ai` + `@ai-sdk/anthropic`, minimal worktree-scoped tools, Claude driver multi-step loop; target T1). Phase 0 code is in `apps/indusk-mcp/src/lib/run/` + `src/bin/commands/run.ts` + `apps/indusk-mcp/fixtures/guinea-pig-semver/`. CRITICAL context: Phase 0 originally ran with NO real gate enforcement because the impl was authored with the wrong phase-header level (`## Phase N` instead of `### Phase N` + `#### Phase N Gate`), so `validate-impl-structure.js` parsed zero phases and vacuous-passed it. FIXED — impl reformatted, 6 phases + 18 gate subsections now parse, `gate_policy: auto`. The vacuous-pass is queued as highlight h-20260727-001 and should become a lesson + an indusk-mcp fix (reject a `trajectory: required` impl that parses to 0 phases, rather than passing silently).

---

## Session 930d7469 — dawn-ui-plan-grouping Phase 3 (parent-plan cards) — Phases 1-2 shipped; also Dawn master plan restructure + orchestrator Phases 1-5

**Session ID**: 930d7469-8a78-4e35-bc48-6a041378bfa7
**Last updated**: 2026-08-03T04:01:33.528Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

**dawn-ui-plan-grouping** (worktree `~/code/sandbox/dusk-worktrees/dawn-ui-plan-grouping`, branch `plan/dawn-ui-plan-grouping`): Phases 1-2 shipped + committed, T1-T9 passing. Plan hierarchy is now declared top-down in frontmatter — root `master.md` carries `parents:`+`roadmap:`, each parent's own `master.md` carries ordered `subplans:`, children declare nothing. `readPlanDeclarations()` in the shared parser (exported at `@infinitedusky/indusk-mcp/planning/plan-parser`); prose link-scraping in `readMasterPlanOrder` RETIRED. Sidebar renders parent groups with declared-order children + greyed placeholders for uncreated subplans. **Phase 3 authored but NOT started** — parent plans render as a blank page today.

Also this session: Dawn re-founded as a real master plan (`indusk-v2-dawn/master.md`, 8 components with status/acceptance/order, trunk commit 0135927d) + `positioning.md`; pre-refounding research archived. dawn-external-orchestrator Phases 1-5 shipped on its own worktree (falsification found + fixed a bash gate bypass; cleanup split gate.ts/loop.ts).

### Open Questions

(1) **Two falsification findings recorded, unfixed:** (a) opening a parent plan is a blank page — a parent carries master/maxims/positioning, none in the admin's `DOC_FILES`, and `PlanDetail.tsx:107` (`{!plan.impl && <FalsificationSection/>}`) then renders unconditionally; Phase 3 fixes this. (b) **Un-migrated projects lose sidebar order** — retiring the link-regex means any project whose master.md has no `roadmap:` frontmatter now shows everything as Unordered. This repo's order was preserved by hand; the other 8 registered projects were never considered. Needs a fallback or a migration note.
(2) Kanban with drag-reorder: Sandy wants it, no plan exists (only passing mentions in archived indusk-admin-ui ADR). It REVERSES a documented decision — brief + `/decisions/indusk-admin-ui` commit the admin to read-only — so it needs its own plan with an explicit writable-admin decision. Now feasible because order lives in frontmatter, not prose.
(3) dawn-external-orchestrator: A8 redefined as the clean experiment (same model, vary harness: Opus+ClaudeCode vs Opus+atdawn) — needs an Anthropic key; then /retrospective + merge + publish.
(4) Registry test-pollution: `multi-agent-init.test.ts:66` registers temp dirs in the REAL `~/.indusk/projects.json` (pruned 398→9 by hand this session). Candidate plan `registry-test-isolation`.

### Cursor

**Next: `/work dawn-ui-plan-grouping` → Phase 3.** Fully specified in the impl with the exact fix location. Four items: detect a parent (has declared subplans) and render a card per subplan with status; placeholder cards for uncreated ones; guard the doc-less path (fixes the stray Falsification heading at `apps/indusk-admin/src/components/PlanDetail.tsx:107`); surface the parent's own `master.md` prose above the cards via `<Markdown>`. T10 is `planned` — author it RED first.

To preview: `pnpm --filter indusk-admin dev` from the worktree, then `/p/dawn-wt/` (NOT `/p/dusk/` — trunk has no declarations yet, so it correctly shows the flat fallback). `dawn-wt` is a temporary registry entry pointing at the worktree; delete it after merge.

After Phase 3: /falsify (carry both findings above) → /cleanup → /retrospective → merge → publish (only then does `indusk ui` show grouping, since it serves the pre-built bundle).

**Hazard hit twice:** shell cwd resets between Bash calls, so relative-path edits landed in the TRUNK instead of the worktree. Both caught and reverted; use absolute paths when working across trees.

---

## Session d98ac424 — eval: dawn-verify component 6 plan artifacts

**Session ID**: d98ac424-b4f3-4d32-873e-0125a64a28d2
**Last updated**: 2026-08-05T13:08:11.772Z
**Branch**: plan/dawn-verify
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/dawn-verify

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 1a10fca6 — eval agent: scoring commit 1258b43b (dawn-verify plan 6)

**Session ID**: 1a10fca6-d2d6-4bc7-82fc-d87768fe46b9
**Last updated**: 2026-08-05T13:08:53.384Z
**Branch**: plan/dawn-verify
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/dawn-verify

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---
