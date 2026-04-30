# Handoff

**Date:** 2026-05-03
**Session:** Two threads. (1) **Path-to-code-freeze cleanup** — shipped 1.28.7 (CGC scope reduction + telemetry restart bugs + falsification test cleanup + plan-parser fixture drift) and staged 1.28.8 (init becomes opinionated about Biome — adds devDep, migrates simple scripts, surfaces vestiges). (2) **Dawn ledger expansion** — landed two new research docs (verbatim FDE-and-extraction thread + architecture companion sharpening the codebase/Dawn-app split, worktree inheritance, emission-only direction); revised U1 + A8 in place; added A9–A14 + O10–O15 to the ledger.

## What Was Being Worked On

Sandy's framing: get tests green + telemetry reliable, then code-freeze this repo and start fresh in **Dawn** (the new repo's name). Path-to-freeze is six items:

- ✅ #1 Telemetry test reliability — shipped 1.28.7 (real prod bug, not flake)
- ✅ #2 Bump 1.28.6 → 1.28.7 (Sandy published)
- ✅ #3 Falsification stale assertions cleanup — shipped 1.28.7
- ✅ #4 Plan-parser fixture drift — shipped 1.28.7
- ⏳ #5 Numero smoke (Sandy explicitly said "I can do numero")
- ⏳ #6 Mark code freeze in CLAUDE.md Current State

Plus a sixth thread that landed mid-session: **opinionated Biome in `indusk init`** (1.28.8 staged, awaiting Sandy's publish). Triggered when Sandy noted that pre-1.28.8 init produced exactly the half-done state Numero is in (`biome.json` written but `@biomejs/biome` never installed; ESLint/Prettier vestiges remain functional).

Plus a parallel Dawn research thread driven by Sandy sharing the FDE/AST-rule-engine doc.

## Where It Stopped

Last completed action: **wrote three docs and updated decisions.md** in `.indusk/planning/indusk-v2-dawn/`. New file inventory:

- `research-fde-and-extraction.md` — verbatim from Sandy's shared thread (Avoca catalyst)
- `research-dawn-project-architecture.md` — companion doc sharpening the codebase/Dawn-app split with the signal-correlation loop made concrete
- `decisions.md` — U1 revised in place (petals = emission points; Dawn app = correlation point); A8 revised in place (skills/hooks live in Dawn app, projected per active agent); A9 (fork-and-extract as special case), A10 (AST rule engine, rejects markers), A11 (tree-shaped worktree inheritance), A12 (emission-only direction), A13 (codebase contains ONLY prod + tests + OTel rules), A14 (`apps/dawn-test-target/` synthetic) added; O10–O15 added (rule-engine syntax, AST library, OTel conflicts, reviewer UI, rebase conflicts, codebase identity discovery)

40 ledger entries total; A9–A14 and O10–O15 are at state `new` awaiting Sandy's walkthrough → `decided`.

## What's Next

1. **Confirm 1.28.8 publish status.** I bumped + wrote the changelog entry + verified build/tests green; Sandy was going to publish. First action: `npm view @infinitedusky/indusk-mcp version`. If returns 1.28.8, smoke `indusk init --force` against a half-done fixture (or just do it on Numero — that's the real test). If still 1.28.7, ask Sandy if he wants to publish or leave staged.
2. **Numero smoke.** Sandy will drive — but be ready to advise. The Numero audit identified: 6 `lint` scripts pointing at eslint/next-lint, 1 root `format` script using prettier, 1 ESLint config (`apps/admin/eslint.config.mjs`), `eslint ^9` in `apps/admin` devDeps, `prettier ^3.2.5` in root devDeps. After 1.28.8 publishes, `indusk init --force` in Numero should migrate the simple scripts + add `@biomejs/biome`, leave compound scripts (`packages/game-logic/package.json` lint script if any compound) untouched with a warning, and surface vestige punch list.
3. **Mark code freeze in CLAUDE.md** Current State once Numero smoke is green.
4. **Continue walking the Dawn ledger in `/research` mode.** A9–A14 + O10–O15 are fresh and need walkthrough. Existing `new` items from previous session also still pending: U1–U3, D1–D2, A1–A8 (all `new`). The ledger has accumulated a lot — Sandy may want to batch-decide or walk one at a time.
5. **Author the Dawn brief** once the ledger stabilizes. Sandy framed it as a "product brief" (sets rules), not just a "project brief" (single delivery). Ledger needs to settle first.

## Open Issues

- **1.28.8 publish status unconfirmed** — Sandy said he'd publish; haven't seen the version flip yet. Don't assume.
- **`apps/dawn-test-target/` doesn't exist yet** — A14 commits to building it but it's a v2 deliverable, not a v1 task. Dawn lives in a separate repo; this dusk repo is heading to code-freeze. The synthetic test target may end up in Dawn's repo, not dusk.
- **CGC extension is still installed** in dusk — only the *forced* flows were removed (catchup gate, eval allowed-tools, beam query, code-graph step). The extension itself still works; agent can manually invoke `mcp__codegraphcontext__*` if specifically wanted. This is by design.
- **Pre-existing test count drift** — 444 tests passing as of session end, was 444 passing + 13 failing at start. All 13 failures resolved in 1.28.7. None of the resolved failures were caused by my edits in this session — they were real bugs (3 categories) that had been masquerading as environmental flake.

## Decisions Made This Session

Several formalized in code/changelog/ledger; flagging the ones that may need lifting to CLAUDE.md or other durable docs:

1. **CGC moves from required to optional in v1** — formalized in 1.28.7 changelog entry. Foreshadows D2 in the Dawn ledger ("CGC as required → optional petal"). Worth a CLAUDE.md "Current State" note when Sandy marks code freeze.
2. **Biome is the opinionated default for `indusk init`** — formalized in 1.28.8 changelog entry. CLAUDE.md gotcha already says "Biome over ESLint" so the conventions are consistent; the change is in init's *behavior*, which the changelog captures.
3. **Dawn architecture is two surfaces (Dawn app outside the codebase + codebase containing only prod + tests + OTel rules)** — formalized in `research-dawn-project-architecture.md` + ledger entries A11/A12/A13. Stricter than "system Dawn vs worktree Dawn." No per-worktree Dawn install. Worktrees never have a Dawn install. The Dawn app discovers them; they don't announce themselves.
4. **Marker-based OTel extraction is rejected** in favor of AST-driven rule engine — formalized as A10. Important because we hadn't formally written down the marker approach but probably would have reached for it. The rejection saves future work from going down the wrong path.
5. **Three real production bugs fixed in 1.28.7**, framed as bugs not test fixes:
   - `daemonRestart` was reading commander defaults instead of inheriting bound ports → would have collided with any user's machine-global daemon
   - `isPortFree` bound to 127.0.0.1 → false-positive "free" when daemons hold IPv6 wildcard `*:port`
   - `telemetryRestart` was forwarding commander default strings → couldn't distinguish "user passed flag" from "default supplied"

## Watch Out For

- **Catchup status template lost the `- [ ] graph` row** in 1.28.7. Old handoffs (this one's predecessor) had `- [ ] graph` in the Catchup Status section. The new template (mirrored to `.claude/skills/handoff/SKILL.md` and `.claude/skills/catchup/SKILL.md` in this session) does NOT include it. The check-catchup.js hook still verifies FalkorDB + Graphiti reachability (port 6379 + 8100); CGC dropped silently. If you see a stale handoff with `[ ] graph` it's pre-1.28.7.
- **`indusk init` is now opinionated about Biome** (1.28.8). Running `init --force` on a non-Biome project will: add `@biomejs/biome` to root devDeps, replace simple lint/format scripts. Leave compound scripts (`&&` / `||` / `;`) ALONE. Surface vestige warnings for residual configs/devDeps. The `[Lint migration warnings]` block prints AT THE END of init output but BEFORE step 7 (handoff scaffold) — so it's mixed in with subsequent init output if you grep filter. Use raw output or scroll up to find it.
- **Numero is still half-done** until Sandy runs `indusk init --force` (or migrates manually). If you see Numero conversations, the audit punch list lives at the top of this session's reasoning — also captured in the 1.28.7 / 1.28.8 changelog entries.
- **Dawn ledger has A1–A14 + U1–U3 + D1–D2 + O1–O15 to walk through in /research mode.** Don't try to walk all 40 in one session — Sandy paces these one decision at a time, often pivoting mid-walk. Let him drive.
- **`apps/indusk-mcp/CLAUDE.md` is a STUB** (template content for a fresh init). The real CLAUDE.md is at the dusk repo root. Don't get confused by the stub when it surfaces in system reminders.
- **`.claude/handoff.md` is gitignored** per InDusk convention. Safe to overwrite.
- **The Dawn repo doesn't exist yet.** When Sandy says "Dawn" he means the planned next-repo. All the architecture decisions live in `.indusk/planning/indusk-v2-dawn/` here in dusk. When Sandy starts Dawn, that planning will move (or be referenced).

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
