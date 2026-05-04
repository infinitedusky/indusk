# Git-Mode Manual Smoke (T8)

**Plan**: `git-or-jj-substrate`
**Test**: T8 — after a user runs `git commit -m "..."` inside a Claude Code session in a git-mode InDusk project, a scorecard entry appears in `.indusk/eval/results.log` within 60 seconds.

This test cannot be automated — the eval hook fires inside Claude Code's tool-execution path, so verifying it requires driving Claude Code itself. This procedure is what a human runs to confirm the path works end-to-end.

## Prerequisites

- `claude` CLI installed and authenticated (`which claude` returns a path)
- `node` ≥ 22, `pnpm` available
- A built indusk-mcp dist (`pnpm --filter indusk-mcp build` from repo root)
- The local indusk-mcp dev CLI accessible — either `npm link` it globally, or use the `INDUSK_BIN=node /path/to/dist/bin/cli.js` env var pattern

## Procedure

### 1. Create a fresh git-only fixture

```bash
cd /tmp
rm -rf git-mode-smoke-fixture && mkdir git-mode-smoke-fixture
cd git-mode-smoke-fixture
git init -q
git config user.email "test@test.invalid"
git config user.name "T8 Smoke"
echo '{ "name": "git-mode-smoke", "version": "0.0.0" }' > package.json
echo '# Git Mode Smoke' > README.md
git add . && git commit -q -m "initial fixture"
```

Expected: a tmpdir with a single initial commit, a package.json, no `.indusk/` yet.

### 2. Run `indusk init` against it

```bash
# Using the dev CLI from the dusk repo:
INDUSK_BIN="node /path/to/dusk/apps/indusk-mcp/dist/bin/cli.js" \
  node /path/to/dusk/apps/indusk-mcp/dist/bin/cli.js init --no-index

# Or, if you've globally linked indusk:
indusk init --no-index
```

Expected output should include:
```
[Config]
  create: .indusk/config.json (mode: full, scm: git)
```

Verify:
```bash
cat .indusk/config.json | grep '"scm"'
# → "scm": "git"
```

### 3. Open the fixture in Claude Code

```bash
# From the fixture root:
claude .
```

Wait for the session to initialize (catchup runs). The session should open without errors related to jj.

### 4. Make a trivial code change

Inside the Claude Code session, ask the agent to:

> "Add a TODO comment to README.md saying 'fixture for T8 manual smoke'."

The agent should make the edit. **Do not let it commit yet** — we want to commit manually in the next step to fire the eval hook deterministically.

### 5. Commit via the terminal pane

In a terminal in the same fixture directory:

```bash
git add README.md
git commit -m "test: T8 smoke — add fixture comment"
```

The commit should succeed (no jj failures, no missing-tool errors).

### 6. Watch for the scorecard

```bash
# Tail the eval log while the eval agent runs in the background:
tail -f .indusk/eval/results.log
```

Within ~60 seconds, a new JSON line should appear with:
- `"changeId"` matching the short SHA of the commit you just made (`git rev-parse --short HEAD`)
- `"mode": "eval"`
- `"summary": "..."` (one-line summary from the evaluator)
- A `"questions"` array with one entry per rubric question

If a scorecard appears with the matching changeId — **T8 passes**.

If 60 seconds pass with no scorecard, check `.indusk/eval/system.log` for hook errors. Common causes:
- Eval hook didn't fire (PostToolUse hook for `Bash(git:*)` not registered — check `.claude/settings.json`)
- Claude CLI not on PATH for the spawned subprocess
- Authentication issue with claude (run `claude` manually to confirm it works)

### 7. Record the result inline on T8

Edit the impl trajectory row for T8 to record the run:

```markdown
| T8 | A8: after `git commit -m "..."` inside ... | Phase 0 | Phase 5 | passing |
```

Then below the trajectory in a comment:

> **T8 manual run, YYYY-MM-DD**: scorecard `<id>` appeared at `.indusk/eval/results.log` ~Xs after `git commit`. Verified.

### Cleanup

```bash
cd /tmp
rm -rf git-mode-smoke-fixture
```

## What Counts as a Pass

T8 passes when a scorecard with the matching commit's changeId is written to `.indusk/eval/results.log` within 60 seconds. The scorecard's content quality is NOT part of T8 — that's covered by other rubric tests. T8 is purely about the hook firing correctly on `git commit`.

## What Counts as a Fail

- Scorecard never appears (eval hook didn't fire, or eval agent crashed silently)
- Scorecard appears but with the wrong `changeId` (hook fired on a different commit)
- Scorecard's `error: true` field is set (eval agent itself failed — investigate `.indusk/eval/system.log`)

If T8 fails, capture:
- The output of `git rev-parse --short HEAD` after the commit
- The contents of `.indusk/eval/system.log` from the time of the commit
- The contents of `.indusk/eval/results.log` (if anything was written)

…and either reopen the impl with a fix-in-scope phase or queue a follow-up plan.
