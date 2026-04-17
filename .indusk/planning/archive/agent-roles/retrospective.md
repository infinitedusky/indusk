---
title: "Retrospective — Agent Roles"
date: 2026-04-18
plan: agent-roles
status: closed
---

# Agent Roles — Retrospective

## What We Set Out to Do

Formalize the three-tier split between working agent, eval agent, and infrastructure that had been growing organically in the system. Replace the working agent's direct `graph_capture` calls with a **highlights queue** that the eval agent processes asynchronously into structured Graphiti episodes. Ship the MCP tool surface, skill-level trigger-point migration, `/highlight` user-facing command, session-end trigger via `/handoff`, and three-tier role documentation in CLAUDE.md.

The plan was the season opener — the entry point for this session's long arc across four shipped plans. Its outputs seed every downstream plan's infrastructure.

## What Actually Happened

Four phases shipped in indusk-mcp 1.17.0 on 2026-04-17 as planned:

- **Phase 1:** highlights queue (`.indusk/highlights.jsonl` + `highlights-processed.jsonl`) + three MCP tools (`highlight`, `highlights_unprocessed`, `highlight_mark_processed`) + file format + tests. T1–T5 passing.
- **Phase 2:** migrated planner / work / retro skills from direct `graph_capture` to `highlight` calls at four trigger points (brief-accepted, adr-accepted, correction, retro-lesson). Grep regression test T6–T9 confirmed no process skill references `graph_capture` or raw `add_memory`.
- **Phase 3:** eval agent prompt processes unprocessed highlights (Step 4 of `buildEvaluatorPrompt`), maps levels to Graphiti edge weights (critical → 1.0, important → 0.6, note → 0.3). T10 passing.
- **Phase 4:** `/highlight` slash command, handoff-skill session-end trigger via `eval-trigger.js --source handoff`, three-tier role table in CLAUDE.md. T11–T14 passing.

**Then:** the Phase 3 end-to-end smoke (write highlight → `jj describe` → confirm processing) exposed that **the eval agent itself had been silently failing since 2026-04-11**. Not a flaw in agent-roles' design — a pre-existing bug that agent-roles was the first plan to actually exercise end-to-end. Reopened impl, added `blocked_by: [improvement-eval-agent-open-telemetry, bug-fix-eval-agent]`, and spawned those two as blocking micro-plans.

- **Spawned `improvement-eval-agent-open-telemetry`** → shipped OTel traces + logs (1.19.0) + Dash0 routing. That plan's falsification ritual identified the actual root cause of the silent failure.
- **Spawned `bug-fix-eval-agent`** → fixed the hook's CJS `require()` in ESM-spawned subprocess (1.19.1). Post-publish, hook-spawned evaluators produce scorecards within 120s.

Returned to agent-roles' Phase 3 smoke. Fired `jj describe` with 3 highlights queued. Evaluator ran, wrote scorecard, BUT `graphitiWrites: 0` and `highlights-processed.jsonl` never got created. `/falsify agent-roles` turned up the **new** hypothesis: the spawned `claude --print` subprocess isn't loading `.mcp.json`, so the `mcp__indusk__*` / `mcp__graphiti__*` tools aren't reachable from it. Every eval run since the fix has written scorecards but called zero MCP tools.

**Spawned third downstream plan:** `eval-agent-mcp-access` — diagnose + fix MCP tool access in the spawned subprocess.

**Net result on agent-roles' contract:**
- Working agent → highlights queue → MCP tools: ✅ fully operational
- Eval agent infrastructure (prompt, span taxonomy, trigger-point wiring): ✅ shipped
- Eval agent actually processes highlights end-to-end: ❌ blocked by MCP-access gap (downstream plan)

That gap is an operational concern, not a contract break. agent-roles documented and shipped the roles split. The runtime ability of the eval-agent tier to execute its half is a downstream infrastructure problem.

**Structural impact (eyeballed):**
- New modules: `apps/indusk-mcp/src/lib/highlights/highlights.ts` (~170 LOC), `src/tools/highlight-tools.ts` (~110 LOC)
- Modified: `src/server/index.ts`, all three process skills, handoff skill, eval-trigger hook, prompt-builder, CLAUDE.md
- New tests: 4 test files, ~20 test cases (T1–T14)
- New docs: `highlights.md` reference page, CLAUDE.md role subsection, changelog entry

## Getting to Done

Seven things that weren't in the original plan:

1. **Phase 3 smoke exposed a pre-existing silent failure.** Not an agent-roles bug — a 6-day-old regression in the eval hook. The plan became the symptom-catcher for a deeper bug that had been hiding because no other workflow fully exercised the hook-spawn path.

2. **Reopening an impl mid-`/work` is structurally supported and worked cleanly.** Flipped `blocked_by` on agent-roles to add downstream blockers, shipped those, returned to agent-roles. The check-plan-order hook enforced the ordering at every boundary. Discipline held.

3. **Three downstream plans spawned from agent-roles' falsification findings.** `improvement-eval-agent-open-telemetry`, `bug-fix-eval-agent`, and `eval-agent-mcp-access`. This is the "falsification catches gaps the author didn't think of" discipline compounding — each downstream plan's own falsification can surface MORE gaps. We're on a chain now.

4. **The OTel plan's diagnostic tooling paid off exactly as intended.** `bug-fix-eval-agent` didn't need its own diagnostic phase because the OTel spans' absence (for hook-spawned changeIds in Dash0) was the signal. This validates the "ship observability first, use it for subsequent plans" ordering.

5. **The user's intent clarification — "the real goal was the split, highlights work, that's enough" — narrowed the falsification outcome cleanly.** Without that clarification, I might have tried to fix MCP access in-scope for agent-roles, expanding the plan indefinitely. The user's judgment on what "done" means kept the plan's scope honest.

6. **The straight-to-impl micro-plan pattern got dogfooded three times.** `improvement-eval-agent-open-telemetry`, `bug-fix-eval-agent`, `eval-agent-mcp-access` — all brief+impl, no ADR. The pattern holds. Each shipped in ~90 min of execution.

7. **The `evalCount: 11` resume-session trap.** We discovered during the re-smoke that the hook's persistent-evaluator uses `claude --resume` with a short prompt that doesn't re-mention highlight processing. Cleared the session, got a full-catchup run — but even then, `graphitiWrites: 0`. Two layers of confusion before landing on the real cause (MCP access).

## What We Learned

1. **A plan's architectural contract and its runtime operation are different things.** agent-roles shipped the architecture (roles, queue, tools, prompt) correctly. The operation (eval agent actually processing) requires additional infrastructure work. Early plans in a multi-plan arc should explicitly distinguish "architecture shipped" from "operation demonstrated" — and not conflate them in Deferred Verification mitigations.

2. **"Run jj describe → see it work" is a ONE-LINER mitigation that hides a dozen assumptions.** We wrote "run `jj describe` and confirm a trace appears" as the Phase 3 Deferred Verification mitigation. What we needed was: "run `jj describe` through the hook path, confirm (a) subprocess starts, (b) runPersistentEval runs, (c) initEvalOtel succeeds, (d) MCP tools are called, (e) highlights-processed.jsonl grows, (f) Graphiti has new episodes." Six sub-assertions collapsed into "see it work." Each one was a potential silent failure.

3. **The highlights queue is a genuinely clean abstraction boundary.** Even though the eval agent's processing is broken, the queue itself is fully functional — the working agent writes, the file is a stable artifact, any future eval agent (this one, the fixed one, a cron-triggered CLI, or a different backend) can consume it. The separation held up under multiple failure modes.

4. **Resume-session prompts need to re-state critical instructions.** The `claude --resume` flow uses a short "just evaluate this change" prompt that drops the original system prompt's Step 4 + Step 5. Subsequent evaluator runs lose all the guidance about processing highlights. The architectural assumption "Claude remembers from the resumed session" is fragile. Either: re-include key instructions on every resume, or: don't use resume for anything that must happen on each run.

5. **Falsification ritual compounds across a plan arc.** The ritual on `improvement-eval-agent-open-telemetry` found the hook-ESM bug → spawned bug-fix. The ritual on bug-fix found the regex-too-narrow problem → fix-in-scope. The ritual on agent-roles found the MCP-access problem → spawned eval-agent-mcp-access. Each plan's ritual surfaces its OWN gap, and the gaps are different from what the author was thinking about. That's the entire point and it works.

## What We'd Do Differently

1. **Phase 3's Deferred Verification mitigation should have been 4 specific assertions, not one.** "Run jj describe and confirm a trace appears" is too broad. Each layer (subprocess start → module load → OTel init → MCP tool call → highlight processed → Graphiti episode written) is a potential failure point. The mitigation should name the specific observable for each.

2. **Include a "which code paths does this exercise" column in Deferred Verification.** If agent-roles had specified "the smoke exercises the hook-spawn code path through to graphitiWrites > 0," the fact that NO hook-spawn had produced scorecards in 6 days would have been caught at plan-authoring time. The plan would have required a working evaluator as a precondition, not as a trust.

3. **Don't use session-resume for workflows where per-run instructions matter.** The eval agent's use of `--resume` saves $2-4 per eval in catchup cost. But the cost is that every instruction in the original prompt's Steps 4-7 has to be re-remembered by Claude across resumes, and Claude doesn't reliably do that. Either: evaluator runs should be cheap enough to skip resume, or: the resume prompt should explicitly re-inject the critical steps.

4. **Smoke tests with N queued items should be part of the plan.** Instead of "write A highlight, see it processed," the plan should have been "queue 3 highlights, verify all 3 get `wrote-episode` or `skipped` entries in processed.jsonl." The N-item scale-up is the thing that catches "worked once then stopped" failures.

## Insights Worth Carrying Forward

- **Shipped-architecture and operational-correctness are two separable claims.** Label them explicitly in impl / retrospective to avoid the "we shipped X but X doesn't work" ambiguity.
- **Multi-plan arcs with each plan's falsification feeding the next plan's scope is a working pattern.** The agent-roles → OTel → bug-fix → MCP-access chain validates the model.
- **Deferred Verification mitigations should name the specific code paths + observables they test.** Single-sentence "run it and see" mitigations are almost always concealing multiple silent assumptions.
- **The highlights queue abstraction is more robust than the specific eval-agent implementation.** File + JSONL + three MCP tools is small, stable, and survives every failure mode we've seen. The processing side is where complexity lives — keep the queue thin.
- **Resume-session prompts drop non-scorecard instructions.** If future code uses `claude --resume` for agent orchestration, either re-include instructions per-resume or don't use resume. This is a general pattern concern, not specific to our evaluator.

## Signals to Graphiti

- Retro lesson: A plan's architectural contract and its runtime operation are different things — document both explicitly.
- Retro lesson: Resume-session prompts drop non-scorecard instructions; per-run instructions must be re-stated or don't use resume.
- Retro lesson: Highlights queue abstraction (file + JSONL + 3 MCP tools) is robust across multiple eval-agent failure modes — the queue holds even when processing breaks.
- Retro lesson: Single-sentence Deferred Verification mitigations hide multiple silent assumptions; split into specific observables per code-path layer.
- Retro hindsight: Phase 3's Deferred Verification should have been 4+ specific assertions (subprocess start, module load, OTel init, MCP tool call, highlight processed, Graphiti written), not one broad "run it and see."
- Retro hindsight: Smoke with N queued items (not 1) catches "worked once then stopped" failure modes.
- Retro audit: Deferred Verification mitigation classified as `downstream-plan` — actually THREE downstream plans (`improvement-eval-agent-open-telemetry` shipped, `bug-fix-eval-agent` shipped, `eval-agent-mcp-access` in-flight). Classification valid; warning none; action: the chain of plans IS the mitigation.
