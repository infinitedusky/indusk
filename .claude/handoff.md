# Handoff

**Date:** 2026-04-21
**Session:** Shipped 1.28.3 (`.env.example` as single source of truth for extension env setup) → patched twice as bugs surfaced. Then ~half the session on vision work: crystallized the signal-correlation product thesis, authored a docs page explaining it, pivoted the v2 plan (`indusk-v2-dawn`) to be a product pivot (not a rewrite), and started working through the decisions ledger in `/research` mode.

## What Was Being Worked On

Two threads, one closed enough to hand off, one mid-flight:

**1. `.env.example` + env-handling in extensions (1.28.3 → 1.28.4 → 1.28.5).**
Shipped 1.28.3 which added `.env.example` templates for dash0 + local-telemetry extensions and wired `extensionsEnable` to copy them on enable. Publish confirmed — user's `indusk update` self-upgraded from 1.28.2 to 1.28.3. Discovered 1.28.3 didn't land `.env.example` for already-enabled extensions because `update.ts` has a separate built-in-extensions refresh loop that doesn't route through `extensionsEnable`. Fixed in 1.28.4 by adding a `.env.example` sync block alongside the existing skill sync in `update.ts`, plus a `cp` hint on add. Then 1.28.5: reshape. Trimmed dash0's `.env.example` to read-side keys only (removed `OTEL_EXPORTER_OTLP_*` — those are service write-side, not extension concerns). Reshaped local-telemetry's `.env.example` as a port-reference docs file (not something to copy). Added `envIsFunctional(name)` gate so the cp hint only fires for auth-headered extensions (dash0 yes, local-telemetry no). Updated both skills with read/write boundary sections. Also trimmed dusk's own `env/contracts/dash0.contract.json` to remove the write-side OTel keys that shouldn't have been in the dash0 extension's contract. Tests added: 3 new unit tests for the `envIsFunctional` gate (15/15 green).

**2. Dawn (v2) pivot — decisions ledger in `/research` mode.**
User decided to pivot to v2 now. Created `.indusk/planning/indusk-v2-dawn/decisions.md` as a live working ledger. Walked through decisions one-at-a-time in research mode. Existing `research.md` from April 7 carried forward as K1–K6 (kept). K6 rewritten from "bespoke migration script" to "coexistence, not migration" — no migration work; indusk + dawn coexist in the same repo with a toggle for which is active. Added A7 (adapter-extension boundary for external tools — hexagonal-inspired but not full Clean Architecture), renamed to avoid overclaiming. Added A8 (agent-neutral skills/hooks with per-agent adapters — `.dawn/skills/` and `.dawn/hooks/` as source of truth; Claude Code becomes just another adapter target). Session ended after A8 was added and I asked "next?" — user said /handoff.

## Where It Stopped

Last completed action: **added A8 to `.indusk/planning/indusk-v2-dawn/decisions.md` + change log entry**. Working in `/research` mode with the user walking through the ledger decision-by-decision.

Ledger currently has:
- **Keep (K1–K6):** decided. K6 is the rewritten coexistence-not-migration form.
- **Update (U1–U3):** flagged as `new` — not yet `decided`. Reframes OTel-as-extension → signal-petal-as-extension, gate model → evidence source model, rewrite inventory expanded.
- **Delete (D1–D2):** flagged as `new`. Semantic graph bridge as central substrate (demoted). CGC as required (becomes optional petal).
- **Add (A1–A8):** flagged as `new`. Big ones: A1 claim/evidence model, A2 three-agent architecture, A3 spiral iteration, A5 "dawn is a product not a rewrite," A7 adapter boundary, A8 agent-neutral skills/hooks.
- **Still open (O1–O9):** pre-existing questions from April 7 research — extension storage shape, config schema, manifest schema, scaffold flow, init reconciliation, local mode rethink, plan parser refactor, migration design (obsoleted by K6 but O8 still says "migration script" — needs updating), planner v2 subplans/timestamps/activity.

## What's Next

1. **Continue through the ledger in `/research` mode.** Specifically: walk through the `new` items (U1–U3, D1–D2, A1–A8) one at a time and move them to `decided` or adjust. The user is driving, so wait for them to pick the next decision.
2. **Resolve or punt the `Still open` list (O1–O9).** O8 is obsoleted by K6 and should be removed/updated. The rest are legitimate open questions that need resolution before or during the brief.
3. **Update `research.md`'s preamble** to mark that the vision crystallized on April 21 and the scope expanded — currently reads as pre-correlation-vision. The decisions ledger supersedes it for current state, but the research doc should reference the pivot.
4. **Author the brief** (`.indusk/planning/indusk-v2-dawn/brief.md`) once the ledger is stable enough. The brief will set path/rules for downstream feature plans. User explicitly framed this as a "product brief" (sets rules), not just a project brief (single delivery). First thing dawn's planner adds might be this brief type.
5. **Publish status check for 1.28.4 and 1.28.5.** I built and smoke-tested both but I don't have confirmation they were published to npm. If `npm view @infinitedusky/indusk-mcp version` returns anything less than 1.28.5, the user still needs to `cd apps/indusk-mcp && pnpm publish --access public`. 1.28.3 was definitely published (update output confirmed).
6. **Verify the signal-correlation docs page renders** — I authored 4 Mermaid diagrams (mindmap for the flower, flowchart for the three agents, two sequence diagrams for the examples) but didn't run `pnpm turbo dev --filter=indusk-docs` to visually confirm. Mermaid syntax should be valid but a visual pass is pending.

## Open Issues

- **1.28.4 and 1.28.5 publish status unclear.** Built, tested green, version bumped, CLAUDE.md updated — but I don't have explicit confirmation user ran `pnpm publish`. Check `npm view @infinitedusky/indusk-mcp version` first thing.
- **Pre-existing telemetry-daemon test flakiness.** `telemetry-extension-enable.test.ts` + `telemetry-init-fresh.test.ts` fail with "Jaeger did not become ready on health port within 15s." Not caused by this session's work; already in handoff history. 3 of ~438 tests; the other 435 + new 15 pass. Environment/timing flake, not a code regression.
- **Composable.env multi-profile compose bug.** Root cause: `src/builder.ts:762` — `writeMultiProfileComposeFile` only ever receives the currently-building profile's entries. Noted upstream at `/Users/the_dusky/code/composable.env/docs/planning/multi-profile-compose/bug-only-current-profile-written.md`. User said they'd deal with it later. Workaround: always chain `env:build <p> && up <p>`.
- **`signal-correlation.md` docs page not visually verified.** Mermaid diagrams written but not rendered. If they break in the real theme, easy to iterate.

## Decisions Made This Session

Most are captured in `.indusk/planning/indusk-v2-dawn/decisions.md` (live ledger) or in `apps/indusk-docs/src/guide/signal-correlation.md` (vision doc). Not yet in CLAUDE.md — worth lifting the stable ones on a future context update.

1. **Dawn pivots to a product, not a rewrite.** Signal-correlation PM system for agent-assisted software development. Positioning: "project management system for building code that self-improves by correlating development and delivery across every signal." Captured in A5/A6.

2. **Six claim-evidence petals + correlation center** as the architectural shape. Tests, OTel, compiler, annotations, preferences, flags. Correlation engine + three agents (monitor, coder, eval) in the middle. Memory compounds via Graphiti. Captured in A1/A2.

3. **Claim model sharpened.** Claims are commitments ("we claim X works"); evidence is observations; claim lifecycle (proposed → under-development → verified → contested → invalidated) is separate from evidence timestamps. Claims live in-repo (trajectory rows, plan docs); evidence flows through native stores; Graphiti holds state history.

4. **Spiral iteration as delivery doctrine.** All petals grow together each cycle; center grows with them; retrospective identifies next cycle's bottleneck petal; new petals sprout when correlation demands them. Captured in A3. Worth codifying as its own skill (`.dawn/skills/spiral/SKILL.md` or similar) in a future session.

5. **Coexistence, not migration.** K6 rewritten. `.indusk/` and `.dawn/` live side-by-side in the same project; toggle switches which is active; no forced port of existing plans.

6. **Adapter-extension boundary** (A7). Core speaks only the claim/evidence protocol; external tools integrate via adapter extensions. Core protocol is versioned. Hexagonal-inspired; not committing to full Clean Architecture.

7. **Agent-neutral skills & hooks** (A8). Skills/hooks live in `.dawn/` as source of truth; Claude Code adapter projects to `.claude/`. Skills declare agent compatibility in frontmatter; adapters filter accordingly. Cursor/Aider/Codex-CLI adapters can be added later without rewriting the skill library.

8. **Claim vs plan granularity.** Claims are orthogonal to plan phases — a phase can require multiple claim states to close; a claim can span multiple phases; a claim can exist outside any plan entirely (standing invariants, SLOs). Claim registry as first-class durable artifact. Regression detection becomes a property of the claim registry (verified claims get continuously evaluated).

9. **Test assertions are not 1:1 with claims.** A claim is a composite of evidence from many assertions across many sources. Test cases are the natural evidence-emission unit; assertions matter for diagnosis when a claim becomes contested.

10. **Dash0/LaunchDarkly/Cursor/Monday framing** for positioning. Product's pitch shape references all four markets while the novel thing is the correlation center. Strategic insight: we don't need to beat any single one; we integrate with them off-the-shelf, thin wrapper provides slight value, depth comes later (Vercel playbook).

## Watch Out For

- **`.indusk/planning/indusk-v2-dawn/decisions.md` is a LIVE working doc.** Expect it to churn further in the next session as the user continues walking through items. Don't lift to CLAUDE.md or docs until stable.
- **Session started in normal mode, then pivoted to `/research` mode around the "product brief vs project brief" turn.** Research mode rules: short answers (1–4 sentences), one claim per turn, suggested follow-ups optional not mandatory. The user explicitly wanted this mode; honor it until they exit. If unsure whether they've exited, ask.
- **Existing `research.md` (April 7) hasn't been updated** to reflect the correlation-vision pivot. The new thinking lives in `decisions.md`. Either add a preamble to `research.md` or accept that the ledger is now the authoritative scope doc.
- **1.28.3 IS published and globally installed on this machine.** 1.28.4 and 1.28.5 publish status unclear — verify before assuming users elsewhere can `indusk update` to pick up the changes.
- **O8 in the "still open" list is stale** — it asks about migration script design, which K6 now obsoletes. Delete or rewrite on next pass through the ledger.
- **Claude Code's `.claude/` dir is currently the source of truth for skills and hooks in v1.** Under A8, dawn inverts this — `.dawn/` becomes the source, `.claude/` becomes derived. Don't start restructuring v1's layout to match; A8 is a v2 commitment, not a v1 change.
- **The docs site's Mermaid `mindmap` syntax uses `root((Text))` — parens matter.** If rendering breaks, try `root(Text)` (single parens) as a fallback. The sequence diagrams are conventional and shouldn't have issues.
- **`.claude/handoff.md` is gitignored per InDusk convention** (see CLAUDE.md gotcha: "Session-specific handoff (not project knowledge)"). Safe to overwrite.

## Catchup Status
- [ ] mcp-ready
- [ ] handoff
- [ ] lessons
- [ ] skills
- [ ] health
- [ ] context
- [ ] plans
- [ ] extensions
- [ ] graph
- [ ] graphiti
