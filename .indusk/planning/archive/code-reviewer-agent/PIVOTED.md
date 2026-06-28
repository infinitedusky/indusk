# PIVOTED

**Archived 2026-06-28.** This plan went through three framings in one day and was archived after the final framing landed on something structurally different from the impl as written.

## Why archived (not just parked)

The parked plan was a per-commit reviewer agent — sibling of the eval agent, fires on `git commit` PostToolUse, emits findings with severity tiers (critical/important/note), follows the bug-finder pattern. The intent that surfaced through three same-day clarifications is materially different: a planner-skill enhancement + standalone `/refactor-check` skill that asks "should we refactor this area before/while we work in it?" — both surfaces backed by a shared analysis engine.

The two shapes share almost nothing. Different trigger, different persona, different output shape, different cadence, different integration point. Resuming the parked plan would have produced exactly the noise the intent rejects.

## The three framings (chronological)

1. **2026-05-07 — original framing: "code reviewer agent like the eval agent."**
   Sibling of eval. Fires on commit. Bug-finder language (critical/important/note severity). MVP rule set: cleanliness, DRY, large functions. Anchored to CLAUDE.md to avoid generic noise. Impl scaffolded, parked unworked for 7 weeks.

2. **2026-06-28 (this morning) — fresh-eyes pass + park.**
   Substrate updates (git-only, exit_code skip, resume-prompt parity, atomic writes, write-time dedup). Then parked until Dawn design partner named — value was real but unfalsifiable when judged only by the plan author on the plan author's own conventions. State: in-progress impl, validator-green, frontmatter `status: parked`.

3. **2026-06-28 (same day) — first reframe: "not a bug-finder, a refactor coach."**
   Sandy: "the real thing is to see if our code could be better, and have that be a constant question we're asking. Is this dry enough? Are we ending up with files that are growing way too long?" Per-commit cadence felt wrong; output as "findings" with severity tiers felt wrong; persona as "critic" felt wrong. Sandy gestured at "like a refactor test or something that happens during each plan."

4. **2026-06-28 (same day) — second reframe + lock-in: pre-plan readiness check + standalone skill.**
   Sandy: "this might even be part of a planning stage thing... for every plan we create, we're also analyzing the code base before we do this. Should we refactor this? Every plan could start with a phase zero or phase negative one." Then: "It's a planner skill enhancement. But I think we're also at a refactor check. And then you can point that to any section." Final shape: dual-surface (planner-integrated + standalone `/refactor-check`), shared analysis engine, refactor suggestions surface as Phase 0 trajectory rows when promoted.

## What this archive preserves

- **`impl.md`** — the parked impl with the fresh-eyes substrate updates from this morning. Useful as a reference for what mirroring the eval-agent shape would have looked like, including the five hazard rows (T17–T21) that captured real lessons from eval-agent failures. **The hazard rows have value beyond this plan** — they're applicable to any future per-commit agent that mirrors eval's shape. If a future plan revives that shape, copy T17–T21 forward.

## What replaces this

A new plan, **not yet scaffolded** as of 2026-06-28. Working name: `refactor-check`. Shape:

- Standalone skill `/refactor-check {section}` — explicit-scope invocation
- Planner-skill enhancement — same engine, implicit scope = boundary map
- Shared analysis engine: read scope → read CLAUDE.md/AGENTS.md → emit ranked refactor suggestions
- Output suggestions promote to Phase 0 trajectory rows when used in planner-integration
- **CGC re-promotes from optional-petal to load-bearing-for-this-skill** — walk-one-hop over the import/call graph is exactly what CGC's structural index does well

Sandy elected to sit with the framing for a few days before scaffolding the brief. The two-iteration-in-one-day cadence was real signal that the design wasn't obvious; a brief authored today vs in three days will be meaningfully different.

## Lessons for the next attempt

1. **Three framings in one day means the original framing was wrong from the start.** The parked plan's title ("code reviewer agent") and trajectory (per-commit, severity tiers, bug-finding) reflected an unexamined assumption that the right shape was "sibling of eval agent." Sandy never wanted bug-finding. The right question — "is this code area in good enough shape to land work on?" — was always different from "is this code wrong?"
2. **The bones of "mirror the eval agent" pulled the design in a direction Sandy didn't want.** Once the parked plan was shaped as eval-sibling, every subsequent thinking step inherited eval's defect-finding paradigm. Future plans that propose "X agent like the Y agent" should pause and ask whether X and Y are doing the same kind of work.
3. **CGC's value depends on the use case.** The 1.28.7 demotion to optional-petal was right for the dominant use cases at the time. The refactor-check use case re-promotes it specifically — the structural index is exactly what walk-one-hop needs. Demotions aren't permanent; they're use-case-conditional.
