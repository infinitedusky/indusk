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

The raw files — the scorecards (`eval/results.log`), the lifecycle log (`eval/system.log`) and the highlights — live in the project's home outside every checkout, the same from every worktree. `indusk eval home` prints it:

```bash
tail "$(indusk eval home)/eval/results.log"
```

That's it. The eval hook fires on every `git commit` inside a Claude Code session. The evaluator's diff-fetch instruction tells Claude to run `git show ${changeId}` against the just-committed SHA.

**One thing to know about**: git's commit-after-work pattern means the eval fires post-hoc — the eval agent has the diff and the session transcript but no pre-stated intent. Plan-driven workflows compensate: the active plan's brief + impl serve as the stated intent that the eval agent reads via `/catchup`.

## When the Model Is Not Reachable

An evaluation can end three ways, and only one of them is a failure.

- **Scored** — the evaluator answered with a scorecard.
- **Waiting** — the model refused the call for a limit (`api_error_status: 429`: rate limiting, or a usage limit such as the weekly one). Nothing is wrong with the commit, so nothing is reported as a broken `every-commit-evaluated`. The commit is logged as `waiting` in the eval log and queued in the project home's `eval/pending.jsonl`. The next commit's trigger tries every waiting commit again before it evaluates its own; one that scores leaves the queue, one the model refuses again stays. No reset time is guessed, since a refusal costs well under a second. `indusk eval` counts waiting commits apart from errors.
- **Failed** — anything else: a `claude` that is not installed, a model that does not exist, a second answer with no scorecard. These still signal the promise broken, with the reason.

If the evaluator answers in prose with no scorecard in it (a resumed session can reply "Noted — …"), it is asked once more, in the same session, for the scorecard JSON only. The run fails only if that second answer has none either.

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
- `missing-context` driving action — you add what's missing to the lessons registry / CLAUDE.md

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
