---
name: rail-check
description: |
  Verify the eval→lessons rail works on this project, surface and clean stray
  state, and drain any backlog of unprocessed highlights through a single
  manual eval-agent invocation. Run this skill when: (a) the user says "I just
  updated indusk" or any phrasing of "post-update", "rail check", "backfill",
  or "the eval pipeline" / "verify the rail"; (b) `mcp__indusk__check_health`
  surfaces a `workbench/stray-state-*` error; (c) `.indusk/highlights.jsonl`
  has > 10 unprocessed entries OR `.indusk/eval/results.log` is empty when it
  should not be. This skill is the canonical post-update procedure for
  workbench-mode projects.
---

# /rail-check — Post-update Rail Integrity Verification

The user just updated their InDusk version OR is concerned the eval→lessons rail isn't working. This skill walks through the canonical verification procedure and, if the queue is dark, drains it through a single manual eval-agent invocation.

## When to invoke

The skill description above documents trigger phrases. Common cases:

- *"I just updated to 1.31.7"* — the user updated to fix workbench-mode rail integrity; verify the rail now works on this project
- *"Check the rail"* / *"Is the eval pipeline working?"* — diagnostic mode
- *"Drain the highlights queue"* / *"Backfill"* — operator knows there's a backlog
- After `mcp__indusk__check_health` returns `workbench/stray-state-*` errors

If the user says any of these, run this procedure end-to-end.

## What this skill does

A 6-step procedure that handles workbench AND single-repo projects:

1. Detect workbench mode (or not)
2. Run `mcp__indusk__check_health` and surface findings
3. If stray-state errors: present them to the user with the recommended `rm -rf` commands and ask for confirmation BEFORE acting
4. Smoke-test the rail with a sanity commit
5. Count unprocessed highlights and decide whether to backfill
6. Backfill drain (if needed) + verify lessons got written

## Procedure

### Step 1 — Detect project shape

Call `mcp__indusk__get_project_info`. Read the result. The `project_root` field is the InDusk state path (workbench root in workbench mode, project root in single-repo mode).

Check whether `.indusk/config.json` has `worktree.wrapped_repo` set. If yes, this is a workbench-shaped project. If no, single-repo.

Report to the user: "Detected {workbench / single-repo} mode at {path}".

### Step 2 — Run check_health

```
mcp__indusk__check_health()
```

Surface every check in the response with status (ok / error) and detail. Group by:

- Extension checks (existing)
- Stray-state checks (new in 1.31.7) — these have names like `workbench/stray-state-wrapped-repo-stray`

If `stray_state` array in the response is non-empty, treat each entry as a finding that needs operator decision in Step 3.

### Step 3 — Stray-state cleanup (if any)

For each stray finding, present to the user:

```
Stray .indusk/ directory found at: {path}
  Why: artifact of pre-1.31.7 init or operator running init from inside the
       wrapped repo. Confuses path resolution.
  Recommended cleanup: {recommendation}
  Should I run this cleanup? (yes / no / inspect first)
```

**Do NOT auto-delete.** Wait for the user's explicit yes per directory. If they say "inspect first," `ls -la {path}` and report contents.

If the directory has content the user wants to preserve, defer the cleanup and note it. If empty or junk, run the recommended `rm -rf` after `yes` confirmation.

### Step 4 — Sanity-commit smoke test

This proves the eval-trigger hook fires correctly after the update. The user should NOT have to do this manually if the workbench fix is working.

Look for any benign file that can take a one-line change (a CLAUDE.md notes section, a changelog entry, a docs file). Add a tiny edit (e.g., a comment update or a single-line bump).

Commit it:

```bash
git commit -am "rail-check: verify post-update eval-trigger fires (1.31.7)"
```

Wait ~5 seconds, then check `${projectRoot}/.indusk/eval/system.log` (or `${workbenchRoot}/.indusk/eval/system.log` in workbench mode):

```bash
tail -20 .indusk/eval/system.log
```

You should see lines like:

```
... hook fired — tool: Bash, command: git commit -am "rail-check: ..."
... statePath: ..., gitPath: ..., eval.enabled: true
... spawning evaluator — module: ..., changeId: <SHA>
... evaluator spawned — source: commit, pid: <PID>
```

**The load-bearing line is `evaluator spawned` with a real PID.** If you see `skip — no git commit ID available` or `skip — no git repo at cwd`, the workbench fix has not taken effect — report this to the user as a regression and stop. They may need to re-run `indusk update` or check that 1.31.7 actually installed.

After ~60s, check `.indusk/eval/results.log` for a new scorecard entry. If present, the full rail (hook → spawn → claude --print → lessons) is working.

### Step 5 — Count unprocessed highlights

Read both files (line counts):

```bash
wc -l .indusk/highlights.jsonl .indusk/highlights-processed.jsonl 2>/dev/null
```

If `.indusk/highlights.jsonl` exists, compute unprocessed = total lines in highlights.jsonl MINUS total lines in highlights-processed.jsonl. (Each line is one highlight; processed dedupes by ID.)

Report:

```
Highlights queue:
  Total in highlights.jsonl: {N}
  Already processed: {M}
  Unprocessed: {N - M}
```

**Decision tree**:
- Unprocessed ≤ 5: rail is healthy, no backfill needed. Skip to Step 6 to verify the lessons landed.
- Unprocessed 6-20: small backfill. Proceed to backfill in Step 5b.
- Unprocessed > 20: significant dark-queue case (e.g., the numero_workbench 86-entry backfill scenario). Confirm with user that the rail-integrity fix just landed and proceed to backfill in Step 5b.

### Step 5b — Backfill drain (if unprocessed > 5)

The eval-agent's prompt drains `highlights_unprocessed` in one pass per invocation. To process the backlog, fire the eval-agent manually:

```bash
node {path-to-eval-trigger.js} --source rail-check-backfill
```

The `--source` flag puts the agent in CLI mode (no stdin event read; no commit-trigger filter). The agent processes the queue, writes lessons for durable rules, marks each highlight processed.

Locate the hook:

```bash
ls -la .claude/hooks/eval-trigger.js
```

If it exists at `.claude/hooks/`, run:

```bash
node .claude/hooks/eval-trigger.js --source rail-check-backfill
```

The hook prints `📊 Eval evaluator spawned (source=rail-check-backfill) for {changeId}. Results will appear in .indusk/eval/results.log` to stderr and spawns the agent in the background. Wait 3-5 minutes for it to drain (longer for large queues).

Monitor progress:

```bash
tail -f .indusk/eval/system.log
```

You should see lifecycle markers: `evaluator spawned`, `evaluator process started`, periodically `evaluator completed`. When you see `evaluator completed — scorecard written` (or `error: ...`), the run is done.

Re-count unprocessed:

```bash
wc -l .indusk/highlights.jsonl .indusk/highlights-processed.jsonl
```

Unprocessed should now be 0 (or close — the agent skips entries that fail the inner validation).

### Step 6 — Verify the lessons landed

List the lessons registry (`mcp__indusk__list_lessons`) and compare against `.indusk/highlights-processed.jsonl`: every entry with `action: "wrote-episode"` names the lesson it materialized in its `detail`. Skipped entries carry their reason — a healthy drain shows a mix (accepted-doc highlights are usually skips because the plan docs already record them; corrections usually become lessons).

Sample 2-3 of the most recent materialized lessons and read their titles to the user as proof of life.

## What to report to the user

After all 6 steps, give the user a concise summary:

```
Rail check complete (post-1.31.7).
  Mode: {workbench / single-repo}
  check_health: {clean / N stray-state findings cleaned / N pending}
  Sanity commit: {evaluator spawned with PID X — rail working / FAILED, see error}
  Highlights backfill: {drained {N} unprocessed → {M} lessons / not needed (already clean)}
```

If anything failed at Step 4 (rail not firing), prioritize that — the user needs to know the fix didn't take and investigate before backfilling.

## Important

- **Never auto-delete stray state.** Ask before each `rm -rf`.
- **Stop at Step 4 if the rail isn't firing.** Don't backfill against a broken rail — that's exactly the failure mode 1.31.7 fixed.
- **The user may interrupt** at any step to inspect or course-correct. This is a 5-15 minute procedure, not a one-shot.
- **If `.claude/hooks/eval-trigger.js` doesn't exist**, the user needs `indusk update` to install it. Report and stop.
- **In workbench mode**, check both `${workbenchRoot}/.indusk/eval/system.log` AND the wrapped repo's `.indusk/eval/` (if any). The latter should NOT exist; if it does, it's the exact stray state Step 3 is for.

## When NOT to invoke

- If the user is mid-plan and hasn't asked about the rail — don't interrupt their workflow to verify it
- If the project has no `.indusk/` directory (not an InDusk project) — `check_health` will say so; stop early

## Cross-references

- The plan that shipped this skill: `workbench-mode-rail-integrity` in master.md (I.4)
- The lesson the fix illustrates: `community-hook-bypass-is-rail-integrity-not-pacing`
- The community lesson on the three-tier discipline: `community-use-highlight-not-direct-graphiti-writes` (name is historical; the discipline — flag, don't materialize — is unchanged)
