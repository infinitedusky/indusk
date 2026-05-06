You can evaluate the current session's work quality on demand.

## When to Use

- `/eval review` — run the eval evaluator against the current working copy
- Mid-session quality check before committing
- When you want to see how the work scores against the rubric

## What It Does

Runs the same evaluator process as the automatic eval hook, but against uncommitted changes instead of a committed change. Uses the project's SCM to read the diff — `jj diff` on jj projects, `git diff` on git projects (read `.indusk/config.json`'s `scm` field via `getScm(projectRoot)`).

## Process

1. Get the current diff:
   - jj projects: `jj diff`
   - git projects: `git diff` (uncommitted) or `git diff HEAD~..HEAD` (last commit)
2. Build the evaluator prompt with the v1 rubric
3. Run the evaluator (uses `runEvaluatorSync` from `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts`) — `runEvaluatorSync` reads `getScm(projectRoot)` and passes the right `scm` value to the prompt builder.
4. Display the scorecard inline
5. Append results to `.indusk/eval/results.log`

## How to Invoke

When the user says `/eval review` or asks for a quality check:

1. Get the current change/commit ID:
   - jj projects: `jj log -r @ --no-graph -T change_id`
   - git projects: `git rev-parse --short HEAD`
2. Call `runEvaluatorSync` with mode `"eval"` and the current transcript path
3. Present the scorecard to the user:
   - Overall summary
   - Per-question results with evidence
   - Any Graphiti writes made

## Important

- This is a quality check, not a blocker — findings are informational
- The evaluator has full MCP access and does a real catchup
- Results are logged to the same eval log as automatic evaluations
- If the evaluator fails, show the error — don't silently skip
