# Lessons — Agent Roles

Distilled from the [`agent-roles`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/agent-roles) plan, shipped as indusk-mcp 1.17.0. This plan formalized the three-tier agent split (working agent / eval agent / infrastructure) and introduced the highlights queue pattern.

## A plan's architectural contract and its runtime operation are separable claims

`agent-roles` shipped the architecture — roles documented, queue built, tools wired, prompt updated — correctly. The runtime operation (eval agent actually processing queued items) turned out to require three downstream plans to make operational. If you don't distinguish these two claims, you'll write Deferred Verification mitigations that conflate them and get surprised.

**Rule:** in impl docs and retrospectives, label claims as either "architecture shipped" or "operation demonstrated." Don't collapse them. A plan can honestly ship the first without the second if the operation gap is genuinely downstream infrastructure.

## The highlights queue abstraction is more robust than the eval-agent implementation

The file + JSONL + 3 MCP tools surface held up through every failure mode we hit this session — stale session state, hook-spawn parse crashes, env-header parser bugs, MCP-access gaps. No matter what was broken downstream, the queue itself kept accumulating entries correctly. Any future consumer (fixed eval agent, cron-triggered CLI, different backend entirely) can read the queue's state and process it.

**Rule:** the thinner the interface between "producer" and "consumer" in an async pipeline, the more resilient the whole pipeline is to consumer failures. A plain append-only file is the thinnest shape. When designing similar boundaries, prefer "stable artifact + thin MCP surface" over "direct function call from A to B."

## Resume-session prompts drop non-scorecard instructions

The eval agent uses `claude --print --resume <sessionId>` with a short "just evaluate this change" prompt. This saves the $2-4 per-run catchup cost — but it also drops every instruction from the original full-catchup prompt's Steps 4–7 (process highlights, write findings, write scorecard). Claude may or may not remember those steps across resumes. Ours didn't.

**Rule:** if you use `--resume` for subprocess orchestration, assume Claude forgets everything except the scorecard question it's being asked. Either re-include the critical instructions on every resume, or skip resume for workflows where per-run instructions matter.

## Deferred Verification mitigations need specific observables per code-path layer

"Run `jj describe` and confirm a trace appears in Dash0" sounds specific but hides six silent-assumption layers:

1. Subprocess spawns successfully
2. Inline script parses
3. `runPersistentEval` loads + runs
4. `initEvalOtel` succeeds + registers
5. MCP tools are reachable from the subprocess
6. Spans arrive at the backend

Each one failed for us at some point. The one-sentence mitigation collapsed them all into "see it work."

**Rule:** when authoring Deferred Verification rows, write one observable per code-path layer. If the layer stack is six things deep, the mitigation should name six specific log lines / file changes / span names. Not "run and see."

## Multi-plan arcs with each plan's falsification feeding the next work

`agent-roles` falsification → spawned `improvement-eval-agent-open-telemetry` + `bug-fix-eval-agent`. Their falsifications → `eval-agent-mcp-access`. Each plan surfaces a gap the author didn't think of, and the gap is different from what the previous plan found.

**Rule:** trust the ritual to compound. Each plan's `/falsify` should find exactly one or two specific in-scope attack vectors — if it's finding many, the plan's scope is too broad; if it's finding none, you've under-investigated.

## Smoke tests with N queued items catch failure modes that single-item smokes miss

Our Phase 3 smoke was "queue 1 highlight, see it processed." That would have caught a total absence of processing, but NOT caught "first run works, subsequent runs stop" or "works for small queue, fails at N=50." We later found the `claude --resume` drift by seeing that a 3-item queue showed `graphitiWrites: 0` across 5 successive runs — a pattern that a 1-item smoke wouldn't have distinguished from "still processing."

**Rule:** smoke tests for async queue processors should use N ≥ 3 items and verify all N get processed OR have a recorded action (wrote-episode / skipped). "It worked once" is the weakest possible contract.

---

## Pointer

Full retrospective: [`.indusk/planning/archive/agent-roles/retrospective.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/agent-roles/retrospective.md)

Falsification log: [`.indusk/planning/archive/agent-roles/falsification.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/agent-roles/falsification.md)

Downstream plans in the chain:
- `improvement-eval-agent-open-telemetry` (shipped 1.19.0, archived)
- `bug-fix-eval-agent` (shipped 1.19.1, archived)
- `eval-agent-mcp-access` (accepted, queued)
