---
title: "Context tiers — a rule reaches you where and when it applies"
date: 2026-10-01
status: accepted
accepted: 2026-10-01
---

# Context tiers — Brief

**What this is:** the root `CLAUDE.md` stops being the one channel for every
kind of knowledge. Each rule is delivered by the mechanism that fits it: an
enforcer that names its lesson when it fires, a context file in the directory
where the work is written, or — for the small remainder that is genuine
cross-cutting design intent — the always-on root file. The 60 KB budget stays as
the ratchet; what changes is what has to fit under it.

## Problem

The root `CLAUDE.md` is at 61,398 of 61,440 bytes and has been pinned at the
ceiling for weeks. The compaction step retires one entry per plan close while a
plan adds two to four, so the eviction decision is made mid-phase, under gate
pressure, by whoever is in a hurry, and the entries that go are the nearby and
long ones, not the least valuable. Every session pays the full file at startup,
and at ~15k tokens it is skimmed, not read — so the "before you act" value that
justifies always-on loading is mostly notional for an entry buried thirty deep in
Known Gotchas.

The deeper defect is that one channel is carrying four kinds of content that want
four deliveries ([research.md](research.md), Findings 2–3):

| Kind | Example in the root file today | Where it should be delivered |
|---|---|---|
| A rule with an enforcer | the eight single-definition pins; trunk refuses code; impl structure | by the enforcer, which names the lesson in its failure message |
| A rule relevant only in one area | the whole admin block; the papers module map; hook-port rules | a context file in that directory, loaded when a file there is touched |
| Design intent with no enforcer and a silent violation | why the lifecycle is one definition; why papers are declared, never inferred | always-on — the only kind that earns it |
| Operational state | the in-flight list; what is next | `current.md`, which already exists for this |

A keyword pass puts 20 of 37 Known Gotchas and 14 of 40 Conventions in the first
row — a second copy of a rule machinery already holds, in a repository that
carries three lessons about one home per fact.

**Why now (Sandy, 2026-10-01):** every plan built from here is built without the
optimal context, including the planning half of Day (`day-contract`), which is
about to author a new set of planning rules that would land in the root file by
default.

## Proposed Direction

Three tiers, applied to every entry, plus one classification pass that is the
real work.

**Tier 1 — Enforce.** A new rule defaults to a hook, a test or a type. This is the
project's existing bet ("hooks enforce what discipline won't"); the plan makes it
the default destination of a Context gate item rather than the exception.

**Tier 2 — The enforcement carries the pointer.** A test or hook that guards a
rule names the lesson it guards with a token in its assertion or refusal
message — `lesson: <name>`, the same shape as `promise: <name>` beside a code
site. When it fires, the agent reads the message, follows the pointer, and gets
the body at the moment it is relevant, at zero standing cost. It is retrieval
triggered by the failure, not by remembering to look, which is what answers the
research's objection to lookup. The lesson body stays in `.claude/lessons/`; the
root entry shrinks to a line or goes. A lesson's state — **guarded** (some
enforcer carries its token) or **advisory** (nothing does) — is **derived by scan
on every read, never stored**, the way paper staleness is; `list_lessons` and the
catchup skim show it, and the catchup skim can shrink to the advisory set.
**Reuse the token-scan shape from day-promises; do not reuse the registry** —
"holding N promises" counts product behaviour, and development hygiene must not
inflate it.

**Tier 3 — Scope by where the work is written.** Directory-scoped context files,
placed by the directory the *edited file* lives in, never by the module the rule
is *about*:

- `.indusk/planning/CLAUDE.md` — trajectory rules, gate vocabulary, test-phase
  structure, the fenced-mask rule, Deferred Verification shape. This file is
  **package-owned and shipped by `init`/`update`** like a skill, so every consumer
  project gets the planning rules at the right moment without carrying them in
  its root file; `skill-sync-parity`'s byte-equality precedent pins it.
- `apps/indusk-admin/CLAUDE.md` — the sidebar tree, badge maps, `next/link`
  mocking, `fileParallelism`, component conventions, the Promises page rules.
- `apps/indusk-mcp/CLAUDE.md` — hook-port rules, the single-definition pins'
  *mechanics*, the papers module map, detector-registration rules.

This works natively. Measured 2026-10-01 (research Finding 4): Claude Code loads
every context file on the ancestor path between a file it reads and the session
cwd, at read time, with no depth limit observed. No injection hook is needed; the
backstop is an **e2e probe** in `apps/indusk-mcp/e2e/` that runs the documented
path against a fixture and asserts the nested codeword arrives — because the
behaviour is observed, not documented, and a silent change to it would silently
lose every tier-3 rule.

**What stays at the root.** Design intent, orientation (What This Is,
Architecture at the level of "what the apps are"), and cross-cutting conventions
with no enforcer and no home directory. The budget hook already applies to every
file named `CLAUDE.md`; after the classification, the root's budget is lowered as
a deliberate config edit to what survives plus headroom, so the ratchet keeps
holding a smaller file rather than a full one.

**The gate and the rituals change to match.** A `#### Phase N Context` item
names its tier and destination ("guard: `<test>` carries `lesson: x`", "planning
context: …", "root: … — always-on because …"); an item targeting the root says
why it must be always-on. The `/claude-md` skill's routing table becomes the
tier table above instead of Conventions-vs-Gotchas. The retrospective's
compaction step becomes classification-at-close: every entry this plan authored
is placed in a tier, and the periodic pass collapses one *root* entry into a
tier-2 pointer or a tier-3 file rather than merely shortening it.
`indusk context check-pointers` walks every context file, not one.

**What is explicitly not done.** No retrieval by subagent (research §Rejected:
the file's job is surprise, and a key fails silently). No load-time truncation
or summarisation and no discipline-only compression (both rejected by the
makeover ADR, and this plan changes *where content lives*, not how it is cut).
No change to the lessons' file format beyond the derived state. No shared
registry with promises.

## Context

- [research.md](research.md) — the arithmetic, the keyword census, the rejected
  subagent approach, the axis rule (scope by where the work is written), the
  Midnight rhyme, and the loading probe.
- [indusk-makeover ADR](../archive/indusk-makeover/adr.md) — established the
  60 KB write-time budget and the compaction ritual, and rejected load-time
  truncation and discipline-only compression. This plan keeps the ratchet and
  finishes the half the makeover left to discipline: deciding what belongs under
  it.
- [day-promises](../archive/day-promises/) — the `promise: <name>` token scan
  whose shape tier 2 reuses (`lib/promises/vocabulary.ts`, `citations.ts`); the
  lesson about running a scanner against the repository that documents its own
  marker applies on day one here too.
- `/guide/context-budget` — the current guide; superseded in part by a
  context-tiers guide at close.

## Scope

### In Scope

- **The classification register.** Every entry in the root file (77 today) gets
  a row: tier, destination, and for tier 2 the enforcer that carries the pointer.
  This is the hand-check the research demands — the keyword census is a
  starting list, not a verdict, and the entries whose named machinery enforces
  only *part* of the claim are the interesting ones. The register is the plan's
  own record that **no rule was lost**: every entry removed from the root is in a
  nested file, behind a token in an enforcer, or deleted with a reason here.
- **The `lesson: <name>` token** in assertion and refusal messages; the scan that
  derives guarded/advisory; `list_lessons` and catchup surfacing it.
- **Three nested context files** (planning — package-owned and shipped; admin;
  mcp), populated from the register.
- **The root rewrite** and the lowered root budget.
- **Skill and ritual updates**: `/claude-md` routing, the Context gate item
  shape in `/planner`, the retrospective's classification-at-close, catchup's
  lesson skim, `check-pointers` over every context file.
- **The e2e loading probe** as a standing regression guard.
- **Docs**: a context-tiers guide; the context-budget guide points to it.

### Out of Scope

- Retrieval by subagent; any index or search layer over the context files.
- Changing the hook/validator gate vocabulary (closed in four sites; a Context
  gate keeps its heading, only its item shape changes).
- `CLAUDE.local.md`, user-global context, or per-worktree context.
- The promises registry and its states — reused as a pattern only.
- Consumer-side migration of *their* root files; consumers receive the shipped
  planning file and the updated skills, and their own root is theirs.

## Success Criteria

- A session whose cwd is the repo root and which edits an impl document receives
  the trajectory and gate rules **without those rules being in the root file** —
  the e2e probe passes against the real `.indusk/planning/CLAUDE.md`.
- A session that never touches the admin app never loads the admin block, and
  one that opens an admin component receives it.
- When a single-definition pin goes red, its failure message names a lesson, and
  `check-pointers` resolves that pointer — across every context file, not only
  the root.
- `list_lessons` reports each lesson as guarded or advisory, derived at read
  time; the catchup summary states the two counts.
- Every root entry has a register row, and the retrospective's context audit
  finds no entry that was removed from the root without a destination.
- The root file is under its **new, lower** budget with at least 20 % headroom at
  close, and the budget value is set in config with its rationale beside it.
- `indusk update` on a consumer installs the planning context file; the parity
  test pins it byte-equal to the package copy.

## Depends On

- [day-promises](../archive/day-promises/) — closed; supplies the token-scan
  shape.

## Blocks

- `day-contract` — component 4c in the Day master plan
  ([indusk-v4-day/master.md](../indusk-v4-day/master.md)), the proposed step
  that puts promises into planning: declared before code, named by every
  trajectory row, confirmed at close. Not yet created. The dependency is soft:
  that step will author a new set of planner rules, and this plan decides that
  they land in the planning context file rather than the root. It can start
  before this closes if its Context gate items are written against the tier
  table from day one.

## Decisions taken at acceptance (Sandy, 2026-10-01)

The brief was accepted with the three recommendations put beside it; each is
recorded here so it is a decision in the plan and not a line in a chat.

- **The root's Current State section moves to `current.md`.** It is 3.9 KB of
  in-flight list duplicating archive pointers — operational state, row four of
  the table. The impl confirms nothing reads it from the root before it moves.
- **The lowered root budget is set in this plan's last phase**, not deferred to
  a later retrospective, so the ratchet is holding the smaller file on the day
  the plan closes.
- **`day-contract` does not wait.** That is component 4c in the Day master plan
  ([indusk-v4-day/master.md](../indusk-v4-day/master.md)), the proposed step
  that declares promises in planning before code. It may start before this
  closes, writing its Context gate items against the tier table from day one.
- **Sequencing — next, after `release-ritual` lands** (decided 2026-10-01).
  `release-ritual` is the plan in flight that makes the version bump a step in
  the retrospective; it adds 84 lines to the retrospective skill, which this
  plan also edits, so this one waits for that merge rather than colliding with
  it. As of the decision it had 32 of 33 checklist items done, with its
  close-out rituals still to run. Then this plan runs and builds, ahead of
  further Day work, so every later plan is built on the smaller root and pays
  no Context-gate eviction tax.

## Open questions for the test plan and ADR

- The token's exact form in a vitest assertion message versus a hook's
  stderr refusal — one grammar for both, so one scanner reads both.
- How the e2e probe gets a `claude` binary in CI, or whether it stays a local
  gate like the rest of `pnpm e2e`.
- The citing rule in the agent-conduct file (prose, silently violated, enforced
  by nothing) is the first candidate for a tier-1 conversion: a Stop-hook check
  on bare labels. In the register, and decided there.
