---
title: "Eval Agent MCP Access"
date: 2026-04-18
status: accepted
blocked_by: []
---

# Eval Agent MCP Access — Brief

## Problem

The eval agent (evaluator) — spawned as a detached `claude --print --resume` subprocess by the `jj describe` PostToolUse hook — is **not calling any MCP tools**. Every scorecard in `.indusk/eval/results.log` shows `graphitiWrites: 0`. No `highlights-processed.jsonl` ever gets created, even after runs with the full catchup prompt that explicitly instructs Claude to:

- Call `mcp__indusk__highlights_unprocessed` to read the queue
- Call `mcp__indusk__graph_capture` to write structured Graphiti episodes
- Call `mcp__indusk__highlight_mark_processed` to mark entries done

**Observed evidence:**
- 5 consecutive evaluator runs across this session: `graphitiWrites: 0` on every one
- One of those runs was a full catchup (121s, not a resume) — got the full prompt including Step 4 and Step 5 with Graphiti instructions — still `graphitiWrites: 0`
- `.indusk/highlights.jsonl` has 3 queued entries; `.indusk/highlights-processed.jsonl` doesn't exist (no processing has occurred)

**Consequence:** the `agent-roles` plan's architectural split — working agent writes highlights, eval agent writes Graphiti episodes — shipped its working-agent half correctly (the MCP tools work when called from this interactive session) but the eval-agent half is a no-op. Highlights accumulate forever in `highlights.jsonl`; nothing becomes structured knowledge in Graphiti; `context_beam` / future search queries don't see the insights.

## Hypothesis

The Claude subprocess spawned via `claude --print --resume <sessionId> --allowed-tools "...,mcp__indusk__*,mcp__graphiti__*,..."` does not have MCP servers loaded. Even though the `--allowed-tools` pattern permits them, the subprocess needs MCP servers to be **configured + started** to have tool surface available.

Possible causes (to be verified in Phase 1):
1. **MCP config not read by `claude --print`** — maybe `--print` mode skips `.mcp.json` discovery
2. **MCP servers need explicit flag** — `claude --print --mcp-config .mcp.json` might be required
3. **Session-resume restores tool inventory from the original session** — and that session was created without MCP tools, so they're missing on resume
4. **Tool-registration race** — the subprocess prints too fast for MCP servers to handshake

## Proposed Direction

**Straight-to-implementation micro-plan** — no ADR, no research beyond Phase 1 diagnosis. Pattern: same as `bug-fix-eval-agent` and `improvement-eval-agent-open-telemetry`. Brief + impl + short falsification + retrospective.

**Phase 1 (diagnosis):** run the hook's exact `claude --print` command manually with DEBUG + an MCP tool request in the prompt, and observe whether the tool is invoked. Identify which of the 4 causes above applies. Document in `diagnosis.md`.

**Phase 2 (fix):** apply the minimal change that makes MCP tools reachable from the subprocess. Likely one of:
- Add `--mcp-config .mcp.json` to the spawn args
- Set env that points Claude at the MCP config
- Fall back to non-resume mode (new session per eval) if resume doesn't restore tools

**Phase 3 (smoke + regression):** post-fix, the evaluator processes the 3 queued highlights on its next run, `highlights-processed.jsonl` gets 3 entries, Graphiti episodes appear in the `agent` / `shared` groups.

## Scope

### In
- Diagnose why `mcp__*` tools are unreachable from the `claude --print` subprocess
- Minimal fix to restore access
- Regression test: assert `graphitiWrites > 0` for evaluator runs where at least one unprocessed highlight existed
- Smoke: process the 3 currently-queued highlights end-to-end (Graphiti episodes land + processed.jsonl fills)

### Out
- Rearchitecting the evaluator process model
- Adding new MCP servers or changing .mcp.json
- Prompt engineering beyond ensuring the instruction is reachable (if tools ARE available and Claude just ignores the prompt, that's a different plan)

## Dependencies

None. This plan unblocks `agent-roles`' retrospective claim that "eval agent is the sole structured writer to Graphiti" — which is currently aspirational, not operational.

## Notes

- Upstream context: `agent-roles` shipped the highlights queue + the roles-split architecture. `improvement-eval-agent-open-telemetry` shipped the traces/logs. `bug-fix-eval-agent` restored hook-spawn. THIS plan restores tool access in the subprocess. Together these four complete the "eval agent as autonomous processor" surface.
- Testing note: a regression test for this is tricky because it requires spawning `claude --print` in CI. Start with the smoke validation (live jj describe + graphitiWrites check) and iterate.
