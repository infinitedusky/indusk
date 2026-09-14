---
title: "InDusk Makeover — Test Plan"
date: 2026-07-23
status: accepted
---

# InDusk Makeover — Test Plan

## Purpose

Behavioral assertions that, together, mean the makeover worked: sessions are drastically cheaper to start and run, nothing load-bearing was lost, the append-only layers now decay, and rules flow project→InDusk→projects. Most assertions are *measurable from outside* — byte/token counts, file states, and a second project receiving a promoted rule.

## Behavioral Assertions

| ID | Assertion (observer-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | The project CLAUDE.md is ≤ 60 KB on disk after the restructure. | script check (`wc -c` gate) |
| A2 | Attempting to grow CLAUDE.md past the budget produces a visible warning/block at write time. | manual test (edit past budget, observe hook fire) |
| A3 | Every compressed Conventions/Current-State entry's pointer resolves to an existing docs page or archived plan doc (no dead pointers). | script check (link walker over CLAUDE.md) |
| A4 | A spot-check of 15 randomly sampled pre-compression entries shows their operative rule still stated in the compressed CLAUDE.md (no live-rule loss). | manual review (falsification-style sample) |
| A5 | A fresh `/catchup` completes with ≤ ~15k tokens of tool-result content (vs ~55k today). | manual smoke (run catchup, count) |
| A6 | `/catchup` no longer performs a Graphiti query or duplicate CLAUDE.md fetch, and completes without error with both removed. | manual smoke |
| A7 | Graphiti and codegraphcontext appear in no MCP config (project or global); their extensions are disabled; `indusk` health check passes without complaining about them. | script check + `check_health` |
| A8 | The highlight → eval → lessons rail still works end-to-end with Graphiti gone: a highlight written in a session is processed by the eval agent at commit time without error. | manual smoke (write highlight, commit, inspect eval log) |
| A9 | current.md contains only the Project (shared) section plus sessions younger than the stale TTL; expired sections are archived, not lost (retrievable from the archive file). | vitest/script (sweep unit) + file inspection |
| A10 | The sweep never touches the Project (shared) section or a live session's section. | vitest (sweep unit, adversarial fixtures) |
| A11 | `list_plans` (and the catchup summary) show only genuinely active plans; the 90+ dead drafts are in `archive/` with their documents intact. | file inspection + `list_plans` output |
| A12 | Global MCP config contains only playwright; project MCP config contains only indusk, dash0, posthog (+ jaeger if kept); a session in another project (e.g. dusk) no longer loads the dropped servers' tools. | file inspection + cross-project smoke |
| A13 | A rule promoted from this project appears in InDusk's shared channel, and a **second project** receives it after running the pull flow (the rule's file exists there with community provenance). | e2e manual smoke across two projects |
| A14 | The pull flow is idempotent and non-destructive: pulling twice changes nothing the second time, and a project's local (personal) lessons are never overwritten. | vitest/script (pull unit) + repeat-run smoke |
| A15 | A plan close (retrospective) on a test plan produces a compact CLAUDE.md entry (rule + pointer), not a narrative block — the compaction ritual is wired into the lifecycle, not just documented. | manual review of the next real retrospective's CLAUDE.md diff |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The compressed CLAUDE.md is *as effective* — future sessions don't repeat mistakes the old narratives prevented. | Effectiveness only observable over weeks of real sessions | A4's sample gate now + a scheduled 2-week review: grep new-session mistakes against archived entries; any repeat-bug traced to a compressed entry gets its rule sentence strengthened in place |
| U2 | Quota burn actually drops proportionally. | Depends on Anthropic-side caching/limits, not directly observable per-session | Before/after comparison of sessions-per-limit-window over a normal week of use; user reports |

## Notes

- A5's "token" measurement: chars/4 on the catchup tool-result payloads is close enough; no need for a real tokenizer.
- A13 needs a second InDusk project as the pull target — use `dusk` or a scratch project; decide at impl.
- A4/A15 are deliberately human-judgment gates — this plan compresses *curated judgment*, so a human samples the output.
