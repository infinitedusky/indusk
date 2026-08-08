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

## Session 3229e048 — dawn-verify closed + merged; 1.36.0 ready to publish; lifecycle-rebalance (Shape) Phase 1 shipped

**Session ID**: 3229e048-5163-4f0c-ac20-c2b0cb5dd411
**Last updated**: 2026-08-08T10:08:49.857Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

**lifecycle-rebalance — Phase 1 of 4 done**, worktree `/Users/the_dusky/code/sandbox/dusk-worktrees/lifecycle-rebalance`, branch `plan/lifecycle-rebalance`, last commit `b81150d5`.

Builds the **Shape check**: per-phase craft review in `/work` (intra-unit) vs `/cleanup` at close (inter-file). Executor behavior, NOT a gate type — the executing agent judges (it is already a model, so no extra call) against prose craft rules the enabled extensions own; findings append as checklist items to the current phase.

- Phase 1 shipped `lib/shape/boundary.ts` (generic phase-boundary record) + `changed.ts`, plus scaffolds for `rules.ts`/`findings.ts`/`shape.ts` that throw naming their phase.
- A5 + A12 green. 18 reds remaining are Phases 2–4's, each failing on its scaffold's throw — live tripwires, not absent code. Suite: 902 passed / 21 failed = 18 intended + 3 known pre-existing.

**Remaining: Phase 2** (extension-sourced rules + findings-into-phase), **Phase 3** (review surface + the `/work` step + skill resync), **Phase 4** (Shape/Cleanup boundary + docs).

**Also ready and waiting on the user: publish 1.36.0.** Bumped and committed on main (`eb82d818`); tarball validated (9.0 MB / 769 files); `npm publish` from `apps/indusk-mcp`, no `--tag` needed.

### Open Questions

- **Publish blockers, shipping unfixed by explicit user call.** No `LEGACY_HOOKS` removal path — a hook deleted from the package stays on disk AND registered in consumers' settings forever (`check-plan-order.js` is the live instance; `grep -rn LEGACY_HOOKS` returns nothing). Pattern to copy is `LEGACY_MCP_SERVERS` in `mcp-migration.ts`. Also: `indusk update` untested against a consumer for this batch (numero-workbench is the bed).
- **Shape's calibration (U1) has no test.** Whether it flags what a thoughtful reviewer would is unknowable by fixture. Standing obligation now recorded in `guide/shape.md`: finding + false-positive counts go in each retrospective's Quality Ratchet; first three plans are the calibration sample; two consecutive plans of human-judged-wrong findings reopens calibration as a falsification hypothesis.
- **The rebalance's other three slices are planned but unwritten**: docs capture/compose (per-phase note, close-out composition), wiring `atdawn verify` into `runLoop`'s phase close, and Challenge (Tier-2 judgment on the diff). Research covering all four is in `.indusk/planning/lifecycle-rebalance/research.md`.
- **Dawn's authoring gap stands.** There is no `atdawn plan` — 2 of maxim 9's 9 loop stages work outside Claude Code (build via `run`, challenge via `verify`). This is why 1.36.0 and not 2.0. Worth an explicit ADR under the Dawn master deciding whether authoring stays rented or gets ported.
- **`atdawn verify` is built but unwired** — one caller, the CLI. `atdawn run` still trusts the trajectory's `State` column at its own phase close, so the only thing that executes a test as a gate fires only when a human types it.

### Cursor

**Next concrete step: Phase 2 of lifecycle-rebalance**, in the worktree above. Start with the test-first duty — no new rows to author (all 12 are already `written`), so go straight to implementation.

1. `apps/indusk-mcp/src/lib/shape/rules.ts` — replace the throwing scaffold. Read enabled extensions from `<root>/.indusk/extensions/*/manifest.json`, then their prose from `<packageRoot>/extensions/<name>/skill.md`. Prefer a craft-ish section heading if present, else the whole skill. Return `{ scope: { inScope, outOfScope }, sources: [{extension, rules}] }` — `outOfScope` must mention duplication AND cleanup (A8 asserts both strings).
2. `apps/indusk-mcp/src/lib/shape/findings.ts` — replace the throwing scaffold. Append an unchecked item to the named phase's implementation block; throw naming the phase when it does not exist (A2's last case). **Return the edited body, never write** — the caller owns the write so the edit flows through the PreToolUse gate chain.
3. Then A1, A2, A3, A8, A11 go green; A4/A6/A7/A10 stay red until Phase 3, A9 until Phase 4.

Gotcha that cost time this session: `indusk worktree create` still requires workbench mode — use `git worktree add`. A fresh worktree also needs `pnpm install` + mcp build + admin build + `bundle-admin.js` or ~16 tests fail on gitignored artifacts.

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

## Session e3a0d51f — eval agent: scoring commit eb82d818 (1.36.0 publish-ready)

**Session ID**: e3a0d51f-6086-44a8-b761-bfe1ee8c84bf
**Last updated**: 2026-08-05T17:11:21.939Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 14a9d87a — eval: score commit eb82d818 (1.36.0 Dawn components 1/2/3/6 release)

**Session ID**: 14a9d87a-bef6-448a-8e60-ed108ee94514
**Last updated**: 2026-08-05T17:13:30.379Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 70c76cf1 — eval agent: scoring commit eb82d818

**Session ID**: 70c76cf1-d3c5-4382-a308-e68de534b432
**Last updated**: 2026-08-05T17:14:08.010Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---
