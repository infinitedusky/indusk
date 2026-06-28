# Numero Workbench Shape — Manual Smoke + Backfill Procedure

The `workbench-mode-rail-integrity` plan (shipped 1.31.7) restored the eval→Graphiti rail on workbench-shaped InDusk projects after a 2-month dark queue. This document is the exact procedure to (a) verify the rail works post-publish and (b) drain a backlog of unprocessed highlights through the now-working rail.

This is the manual mitigation for `U1: Real numero_workbench backfill drain` in [`.indusk/planning/workbench-mode-rail-integrity/impl.md`](../../../.indusk/planning/workbench-mode-rail-integrity/impl.md).

**Audience:** Sandy, or any future operator hitting a similar dark-queue case.

## Prerequisites

- `@infinitedusky/indusk-mcp@1.31.7` (or later) published to npm
- A workbench-shaped target project (`.indusk/` at workbench root, wrapped repo in a subdirectory)
- Graphiti container running (`indusk infra start`)
- A live Claude Code session with `mcp__indusk__*` and `mcp__graphiti__*` tools available

## Procedure

### 1. Update the target project

From the workbench root (NOT inside the wrapped repo):

```bash
indusk update
```

This re-installs the hooks under `.claude/hooks/` (including the 1.31.7 `eval-trigger.js` with workbench-aware path resolution) and re-syncs skills (including the new `/rail-check` skill).

Verify the install:

```bash
grep -l "resolveStateAndGitPaths" .claude/hooks/*.js
# Should print: .claude/hooks/eval-trigger.js, .claude/hooks/check-catchup.js,
# .claude/hooks/check-gates.js, .claude/hooks/validate-impl-structure.js
```

### 2. Run the rail check skill

Invoke from a Claude Code session inside the workbench OR ask the agent: *"I just updated to 1.31.7, run the rail check."*

The agent will:

1. Detect workbench mode
2. Run `check_health` and surface any stray-state findings
3. Walk through each finding with you and offer cleanup
4. Make a sanity commit and verify `evaluator spawned` appears in `system.log`
5. Count unprocessed highlights
6. (If > 5 unprocessed) Drain the queue via a manual eval-agent invocation
7. Verify Graphiti gained episodes

Refer to [`apps/indusk-mcp/skills/rail-check.md`](../../skills/rail-check.md) for the full skill content.

### 3. Manual backfill (if skipping the skill)

If for any reason `/rail-check` isn't available or you want to drive the backfill yourself:

```bash
# From the workbench root
cd ~/code/numero  # or wherever the workbench root is

# Confirm the highlights queue exists and check its depth
wc -l .indusk/highlights.jsonl .indusk/highlights-processed.jsonl 2>/dev/null

# Fire the eval-agent in CLI mode (drains the unprocessed queue in one pass)
node .claude/hooks/eval-trigger.js --source rail-check-backfill
```

You should see on stderr:

```
📊 Eval evaluator spawned (source=rail-check-backfill) for <SHA>. Results will appear in .indusk/eval/results.log
```

The agent runs in the background. For the numero_workbench 86-entry case, expect 5-10 minutes wall-clock time (Sonnet rates: ~$0.50-2 in total claude tokens).

Monitor:

```bash
tail -f .indusk/eval/system.log
```

You should see lifecycle markers `evaluator spawned`, `evaluator process started`, then periodically `processing highlight {id}` or similar, and finally `evaluator completed — scorecard written`.

### 4. Verify Graphiti got the episodes

In Claude Code (with `mcp__graphiti__*` available):

```typescript
// Get the project group from indusk-mcp
const info = await mcp__indusk__get_project_info();
// e.g., info.project_group === "numero_workbench"

// Query Graphiti for episodes in that group
const episodes = await mcp__graphiti__get_episodes({
  group_ids: [info.project_group],
  max_episodes: 100,
});
```

Expect ~N episodes where N approximates the number of unprocessed highlights drained. Some highlights may yield merged episodes (Graphiti's contradiction detection), so the count may be slightly less than the input.

Sample a few episode names + summaries to confirm content quality.

### 5. Re-count unprocessed highlights

```bash
wc -l .indusk/highlights.jsonl .indusk/highlights-processed.jsonl
```

Unprocessed = `highlights.jsonl total` − `highlights-processed.jsonl total`. Should now be 0 (or very close).

### 6. Document U1 outcome

Edit [`.indusk/planning/workbench-mode-rail-integrity/impl.md`](../../../.indusk/planning/workbench-mode-rail-integrity/impl.md), find the `## U1 Backfill Result` section, and fill in:

- Drain command run
- Highlights drained: `N/86`
- Graphiti episodes created in `<project_group>`: `M`
- Findings/errors: any
- Outcome: PASS / FAIL

PASS → continue to `/falsify workbench-mode-rail-integrity` then `/retrospective workbench-mode-rail-integrity`.
FAIL → reopen Phase 2 and investigate which assertion broke.

## What this procedure proves

- The 1.31.7 hook refactor took effect on the target project (`evaluator spawned` in system.log AFTER a commit inside the wrapped repo)
- Stray state was cleaned (if any) per Sandy's "no lingering app-level state" requirement
- The 86-entry dark queue drained through the now-working rail end-to-end
- Graphiti's `numero_workbench` group now has structured episodes for 2 months of project-acceptance, ADR-acceptance, correction, and retro-lesson moments

## Expected failure modes (with mitigation)

| Symptom | Likely cause | Fix |
|---|---|---|
| `system.log` still shows `skip — no git commit ID available` | 1.31.7 didn't install — `.claude/hooks/eval-trigger.js` is still old | Re-run `indusk update` — verify with the grep in Step 1 above |
| `evaluator spawned` appears but no scorecard in `results.log` after 5 minutes | claude --print is failing inside the eval-agent subprocess | Check `system.log` for `evaluator crashed` entries; common cause is `claude` not on PATH or MCP-config absolute-path resolution failing |
| `check_health` reports stray-state errors after Step 3 cleanup | Some directories still contain content; user declined to delete | Inspect the directories manually, decide whether to migrate content to workbench root, then `rm -rf` |
| Graphiti episode count is far below highlights-processed count | Eval-agent's prompt-builder may not be processing every entry, OR Graphiti container OOM-killed mid-run | Check `system.log` for `evaluator crashed` / `processing failed`; consider running the backfill in smaller batches |

## Cross-references

- The skill: [`apps/indusk-mcp/skills/rail-check.md`](../../skills/rail-check.md)
- The plan: [`.indusk/planning/workbench-mode-rail-integrity/`](../../../.indusk/planning/workbench-mode-rail-integrity/)
- The lesson the rail integrity narrative names: `community-hook-bypass-is-rail-integrity-not-pacing`
- The three-tier discipline lesson (why highlights → eval-agent → Graphiti is the rail): `community-use-highlight-not-direct-graphiti-writes`
