# Operational State

This file represents the operational state for the project — what's happening RIGHT NOW. The architectural layer ("what this project is") lives in [`CLAUDE.md`](../CLAUDE.md). The historical layer ("how we got here") lives in `.indusk/planning/` plans + the docs site.

Two regions:

- **`## Project (shared)`** — cross-cutting state any agent can edit. Pre-launch crunch mode, merge freezes, telemetry endpoint changes, anything project-wide.
- **`## Session <short> — <task>`** blocks — per-agent operational state. Each block holds the agent's `### In Flight`, `### Open Questions`, `### Cursor`. Written via `mcp__indusk__update_current_section` at `/handoff` (or any moment something solidifies). Other agents' sections are byte-untouched by your writes.

`/catchup` reads this file pure-read. `/retrospective` distills sections of it into CLAUDE.md on plan close.

## Project (shared)

_Any agent can edit this section. Cross-cutting state that's true for the whole project right now._

- 2026-08-30: the 2026-08-16 publish blockers are all resolved — `LEGACY_HOOKS` removal shipped (`lib/hook-migration.ts`; `check-plan-order.js` gone from disk and settings), the changelog was split per release in 1.36.2, and the batch published through 1.40.x. CLAUDE.md no longer carries version/plan-table copies; operational blockers belong here.

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

## Session 978ca81e — starting catchup

**Session ID**: 978ca81e-783d-4bcd-b16f-761a304a724c
**Last updated**: 2026-08-08T10:19:36.784Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session db0f20a7 — eval agent: score commit f7cb78d2 (lifecycle-rebalance Phase 9 close)

**Session ID**: db0f20a7-74c2-42b9-8e26-72f353591d95
**Last updated**: 2026-08-10T23:48:45.491Z
**Branch**: plan/lifecycle-rebalance
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/lifecycle-rebalance

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 1d9562c1 — eval agent: reviewing commit 45020dc6 (test-phase-structure merge)

**Session ID**: 1d9562c1-d3e9-4c90-bdc5-6f69c5c3a559
**Last updated**: 2026-08-12T20:33:53.401Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 38846b27 — starting catchup

**Session ID**: 38846b27-da1c-43bb-9500-a6bd30e9df75
**Last updated**: 2026-08-13T17:54:18.210Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 7e3e61d1 — status check on jj-residue-rip-out plan

**Session ID**: 7e3e61d1-965e-46ef-a279-5af6ee54fdb1
**Last updated**: 2026-08-14T12:35:47.047Z
**Branch**: plan/jj-residue-rip-out
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/jj-residue-rip-out

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 171f945c — versioned-workbench: Test Phase 1 — author 16 assertions RED

**Session ID**: 171f945c-541c-4d9a-9721-73821d2b905f
**Last updated**: 2026-08-17T21:39:35.967Z
**Branch**: plan/versioned-workbench
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/versioned-workbench

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session f1fd8278 — eval agent: scoring commit c2d8de79 (lessons materialized from jj-residue-rip-out retro)

**Session ID**: f1fd8278-62cb-4542-b83f-af36197b27bf
**Last updated**: 2026-08-17T01:41:22.711Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 172c4189 — eval: reviewing 8c33a96a (test plan Phase 1 RED)

**Session ID**: 172c4189-b859-46f8-8e68-d7a2a2b02e4a
**Last updated**: 2026-08-17T21:56:59.131Z
**Branch**: plan/versioned-workbench
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/versioned-workbench

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 567f052c — eval: reviewing commit 776eac4f (Phase 13 cleanup ritual)

**Session ID**: 567f052c-e3a6-4ad2-8422-926ac6848c52
**Last updated**: 2026-08-27T18:14:52.548Z
**Branch**: plan/versioned-workbench
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/versioned-workbench

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 7216db4f — claude-md skill rename + CLAUDE.md derivable-facts purge + check-pointers version guard

**Session ID**: 7216db4f-a4b3-4455-b90c-90ad85c5a93a
**Last updated**: 2026-08-30T19:42:15.715Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session dd0c95d9 — eval: reviewing writing-skill commit 49042d49

**Session ID**: dd0c95d9-cb48-4fd8-91c4-ec31ad7e2bfd
**Last updated**: 2026-09-10T00:32:44.427Z
**Branch**: plan/writing-skill
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/writing-skill

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session de9c469b — V4 sequence reconciliation, worktree-config-schema-pointer closed, release guard shipped in 1.44.2; next is the Day plan

**Session ID**: de9c469b-afc6-476e-a080-7f7446748415
**Last updated**: 2026-09-15T18:17:52.701Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

Nothing mid-flight. Everything this session touched is merged, archived, and published as 1.44.2.

**Next up — the Day plan.** The V4 sequence is 13 steps; step 1 (workbench-trust-fixes) is closed and merged. Declared order lives in `.indusk/planning/indusk-v4-day/master.md` under `subplans:`, with the human-readable component table in the same file.

Two steps were agreed in conversation on 2026-09-10 and have no folder yet:
- **1.6 ritual forking** — `context: fork` on falsify, cleanup, verify, rail-check, eval-review. The rationale is reviewer independence, NOT token savings: a fork receives the skill body, its args and CLAUDE.md, and nothing from the conversation, so it cannot inherit the justifications the building session accumulated. Its brief must carry a dogfood check that the fork is genuinely clean — make a decision only in conversation, run falsify forked, confirm it cannot see it.
- **6.5 parallel children** — edges as data first (`Depends On` / `Blocks` moved into frontmatter the declaration reader parses), then a runner that takes a parent and runs edge-free children concurrently in their own worktrees. Placed after day-claim-binding rather than after Dawn 6.5, because parallelism multiplies whatever the evidence lane cannot yet see.

Immediate next actions: declare all 13 steps in both masters so the admin sidebar matches the component table, then write the three next briefs. 1.5 hook-cwd-independence is drafted and needs Sandy's acceptance read; 1.6 has nothing; step 2 dawn-workbench-execution has a draft from 2026-09-03 that predates everything learned since.

### Open Questions

- **The Shape library cannot address a test phase.** `prepareShapeReview({ phase: 1 })` resolves to Build Phase 1, so a Test Phase 1 craft review has to be done by hand every time. Carried into `admin-ui-phase-progress`'s brief as in-scope work (the same class as the admin UI's private phase regex — readers that predate test-phase-structure).
- **hook-cwd-independence is unstarted and every gate depends on it.** Hooks are registered `node .claude/hooks/<name>.js`, resolved against the session's drifting cwd, so after any Bash call ending in `apps/indusk-mcp` every gate fails to load with a non-blocking exit 1 and is silently off. Observed, not theorised. Until it lands: cd back to the repo root before impl edits and commits.
- **Does this build offer a conversation-inheriting subagent type at all?** The Agent tool's description mentions a `fork` type but it is not in the listed agent types here. 1.6's brief should not assume one exists without running it.
- **One manual check owed on a real workbench:** open a worktree config and confirm its `$schema` resolves, using the two-file contrast (two schemas that disagree, pointer flipped between them) rather than a single diagnostic. A single type error proves a schema loaded, not which one.

### Cursor

Session ended clean: main at 1.44.2, published, working tree clean, no unmerged plan branches, no worktrees besides the trunk.

What shipped this session, in order:
1. **workbench-trust-fixes** retrospective, archived, merged (24 rows, nine phases).
2. **Sequence reconciliation** — 14 folders archived with `closed_reason`, 4 folded into Day steps, every loose follow-on written into the brief of the step that owns it, standing one-fate rule added to the root master and to the retrospective skill's context audit.
3. **indusk-makeover** closed 53 days after impl-complete; its two deferred rows rewritten to say what actually holds them.
4. **worktree-config-schema-pointer** — four phases, 8 rows, archived. Falsification found three defects, the retrospective's docs audit found a fourth (declared-layout workbenches never reached the ignore top-up).
5. **Release guard** (`apps/indusk-mcp/scripts/release-guard.sh`, wired into `pnpm release`) — four refusals: dirty tree, HEAD not the release commit, unmerged `plan/*` branch touching packaged paths, version already on the registry. Checks 2 and 3 share one PACKAGED_PATHS list so the guard cannot fire on changes that can't reach the tarball.

**The rule that came out of it, now in CLAUDE.md:** `pnpm publish` packs the working tree, not a commit (verified against the published 1.44.1 tarball). Worktree-per-plan means every plan lives on a branch, so a publish from a clean main is blind to it by construction. Bump on main, after the branch merges. Before saying anything about whether a publish is current, read both `git rev-list <release-commit>..HEAD` and `git for-each-ref refs/heads/plan/* --no-merged HEAD`.

Start the next session with `/catchup`, then the Day master.

---

## Session 2dfae2ea — indusk-v4-day: writing — read-as-reader + falsify passes on papers 1-3

**Session ID**: 2dfae2ea-94f9-46f5-a54c-cf61eb7548f3
**Last updated**: 2026-09-10T01:08:38.346Z
**Branch**: plan/writing-skill
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/writing-skill

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 2dfae2ea — writing-skill: /work Test Phase 1 (author every assertion RED)

**Session ID**: 2dfae2ea-94f9-46f5-a54c-cf61eb7548f3
**Last updated**: 2026-09-10T00:24:06.349Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session f9c6df62 — eval agent scoring commit 171d14df

**Session ID**: f9c6df62-8ee7-4317-b88c-c7a17cfa0848
**Last updated**: 2026-09-08T19:06:54.253Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session da8327e4 — eval: reviewing commit 3dbe9a1a (master.md queue entry)

**Session ID**: da8327e4-4ba2-4939-a094-9055c134a4a6
**Last updated**: 2026-09-14T14:42:01.483Z
**Branch**: main
**Worktree**: /Users/the_dusky/code/sandbox/dusk

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---

## Session 30e64e93 — eval: reviewing commit 00bf46bd (worktree-config-schema-pointer Phase 2 red tests)

**Session ID**: 30e64e93-bd7f-4969-a4c4-2a24454f7335
**Last updated**: 2026-09-14T15:37:41.098Z
**Branch**: plan/worktree-config-schema-pointer-phase-2
**Worktree**: /Users/the_dusky/code/sandbox/dusk-worktrees/worktree-config-schema-pointer

### In Flight

(empty)

### Open Questions

(empty)

### Cursor

(empty)

---
