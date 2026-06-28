# Never use String.includes for shell-command trigger detection — use anchored regex

# Never use String.includes for shell-command trigger detection — use anchored regex

When matching against shell command strings to decide whether to fire a hook, scheduler, watcher, or other action, `String.includes` is structurally dangerous — it false-positives on every command whose string content contains the trigger as a substring.

## What goes wrong

`git-or-jj-substrate` Phase 6 added trigger detection like this:

```js
const triggerPatterns = ["jj describe", "git commit"];
if (!triggerPatterns.some(p => command.includes(p))) {
  return; // skip
}
```

Phase 7 falsification surfaced that this fires on:
- `git config user.email "git committer"` — "committer" contains "commit"
- `cat git-commit-template.md` — filename contains "git commit"
- `echo "Don't forget to git commit!"` — prose contains "git commit"
- Many other Bash commands whose string content happens to contain the trigger substring

Result: silent eval-runner spawns + junk scorecards on non-commit commands. Cost-bearing in tokens, latency, and signal-noise.

## The discipline

Use anchored regex with boundary conditions. Two levels of strictness:

**Word-boundary** (minimum):
```js
const TRIGGER_RE = /\b(jj describe|git commit)\b/;
if (!TRIGGER_RE.test(command)) return;
```
`\b` matches the position between a word char and a non-word char, so `git committer` (where "committer" continues past the trigger) doesn't fire.

**Right-edge lookahead** (recommended for shell commands):
```js
const TRIGGER_RE = /\bgit commit(?=$|\s|;|&|\|)/;
```
This rejects `git commit-tree` and `git commit-graph` plumbing commands — bare `\b` matches `t`→`-` and false-positives there. The right-edge lookahead requires end-of-string, whitespace, or shell separator after `commit`.

## When this applies

Anywhere you're matching a Bash command, log line, or other user/agent-controlled string against a pattern that triggers downstream action:
- PostToolUse hooks (Claude Code)
- Pre-commit hooks
- Log watchers / alert rules
- Slack / chat command parsers
- CI trigger conditions
- Webhook routing

## Signal of regression

If the trigger fires on user.email containing the trigger word, or on filenames, or on echoed prose, the pattern is using substring matching. Add a regression test that asserts the trigger does NOT fire on a curated set of false-positive shell commands.

## Related discipline

PostToolUse hooks must also check `event.tool_response?.exit_code` and skip when non-zero. A successful trigger-pattern match on a failed Bash command produces downstream noise (eval against the wrong SHA, scheduler firing on a no-op, etc.). The trigger detection AND the exit-code check together gate downstream action.

