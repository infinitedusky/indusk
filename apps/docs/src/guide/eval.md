# Getting Started with Eval

The eval system scores every commit automatically. No setup needed beyond having InDusk initialized — the hook is registered during `indusk init`.

## Your First Eval

1. Work normally — implement features, fix bugs, follow plans
2. Commit your change — `git commit -m "..."`
3. The eval agent spawns in the background
4. After ~2 minutes, check your results:

```bash
indusk eval summary
```

That's it. The eval hook fires on every `git commit` inside a Claude Code session. The evaluator's diff-fetch instruction tells Claude to run `git show ${changeId}` against the just-committed SHA.

**One thing to know about**: git's commit-after-work pattern means the eval fires post-hoc — the eval agent has the diff and the session transcript but no pre-stated intent. Plan-driven workflows compensate: the active plan's brief + impl serve as the stated intent that the eval agent reads via `/catchup`.

## Interpreting Scores

Each scorecard has four questions. For each one, the judge answers `yes`, `no`, or `partial`:

- **yes** — the agent did the right thing
- **no** — it didn't, and here's the evidence
- **partial** — it partly did

Severity tells you how much to care:

- **info** — observation, no action needed
- **warning** — should improve next time
- **critical** — caused real problems

## What Good Looks Like

Over time, you want to see:
- `conventions` trending toward 100% — the agent follows project rules
- `skipped-steps` at 100% — no instructions ignored
- `better-approaches` improving — the agent finds existing code
- `missing-context` driving action — you add what's missing to Graphiti/CLAUDE.md

## Running a Baseline

Baselines measure "how bad is it without the context system?"

1. Create a task file describing work to do:

```markdown
<!-- tasks/add-error-handling.md -->
Add proper error handling to the API endpoints in src/routes/.
Each endpoint should return appropriate HTTP status codes and error messages.
```

2. Run the baseline:

```bash
indusk eval baseline --task tasks/add-error-handling.md
```

This creates a stripped worktree, runs a vanilla agent, evaluates the result, and shows the scorecard.

3. Compare:

```bash
# See baseline vs eval scores side by side
indusk eval summary --json | jq '.summary'
```

## Adding Questions

Edit `apps/indusk-mcp/src/lib/eval/rubric.ts` and add to the `V1_RUBRIC` array. The judge prompt picks up new questions automatically.

Good questions are:
- **Specific** — "Did the agent check blast radius?" not "Was the code good?"
- **Observable** — the judge can verify by reading the transcript and diff
- **Actionable** — a "no" answer tells you what to fix

## Disabling Eval

If the background eval is unwanted (e.g., during rapid prototyping):

```json
// .indusk/config.json
{
  "eval": {
    "enabled": false
  }
}
```

Or just ignore the results — they don't block anything.
