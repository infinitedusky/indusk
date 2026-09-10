# A Claude Code hook's message reaches the model only via exit-2 stderr or JSON `hookSpecificOutput.additionalContext` on stdout — exit-0 `console.error`/`console.log` reaches only the debug log, and a linter auto-fix can silently delete the one statement that mattered

`gate-reminder.js` was registered as a PostToolUse hook and believed to nudge the agent about which trajectory rows to author, from its original commit through 2026-09-03 — roughly a month with enforcement (Gate A) live and its own advisory half dark the whole time. It never worked.

Root cause, layered:
1. For a PostToolUse hook, `process.exit(0)` with text on stderr reaches only the session's debug log, never the model's context. Reaching the model requires either exit code 2 (stderr becomes visible) or a JSON envelope on stdout carrying `hookSpecificOutput.additionalContext`. The hook used `console.error` + `exit(0)` on every path.
2. The original implementation did emit a JSON envelope, but with only `hookEventName` — no message field — so even that channel never carried the text.
3. A later "biome: auto-fix formatting + lint hygiene" commit (32 files, mechanical) deleted the `console.log` call under the `suspicious/noConsole` rule and renamed the now-unused variable to `_result` to silence the resulting `noUnusedVariables` warning. The underscore marks a lint-suppression artifact, not a design decision — but it reads as one on a casual pass.
4. The file's own docblock said the hook "outputs a reminder message that appears in the conversation as additional context" the entire time — accurate about intent, wrong about behavior, because nobody diffed the described behavior against an actual transcript.

Why it stayed invisible: the hook always exits 0 and never throws, so nothing red ever pointed at it. `writableAtNudge` (defined only in this file) and `getPhaseStartNudge` (exported from `lib/trajectory/state-ops.ts` with zero production callers) are two orphaned halves of one feature — the kind of split that happens when a refactor moves logic but not its caller, and nothing exercises the caller path to notice.

**How to apply:**
- Before trusting that a Claude Code hook "notifies the agent," check exit code AND payload shape: exit 2 (stderr visible) or exit 0 with `hookSpecificOutput.additionalContext` populated on stdout JSON. `console.error`/`console.log` text at exit 0 is dead from the model's point of view no matter how correct the string is.
- Biome's `noConsole` allowlist (`warn`/`error`/`info`) exists for exactly this trap: `console.info` writes to stdout and satisfies both the hook contract and the linter, where a naive `console.log` gets auto-fixed away again. When a hook's only job is emitting a message, prefer `console.info` and add a test that asserts the message appears in the tool's actual output, not just that the function runs without throwing.
- A "the docblock says X" claim about hook behavior is not evidence X happens — verify against a live invocation's actual stdout/stderr, the same way `verify-revert-claims-against-the-actual-diff` insists on checking the diff rather than the commit message.
- An exported function with zero production callers (`getPhaseStartNudge`) is a signal worth grepping for during any hook/nudge audit — it is often the orphaned half of a feature whose other half silently broke.

See `.indusk/planning/workbench-trust-fixes/research.md` F9 for the full finding and `.indusk/planning/workbench-trust-fixes/brief.md` Phase A item 0 for the fix (emit via `console.info` at exit 0, collapse the duplicated nudge helper to one definition).
