# The CLAUDE.md 60KB budget hook (claude-md-budget.js) only fires on Edit/Write — a shell-routed edit to CLAUDE.md bypasses it exactly like plan-document gates

The existing lesson [[edit-plan-documents-only-through-the-edit-tool-not-sed-or-heredoc]] documents that InDusk's PreToolUse gate chain (`check-gates.js`, `validate-impl-structure.js`) only fires on Edit/Write tool calls, so a `sed`/Bash-heredoc write to the same file is invisible to it. `claude-md-budget.js` — the hook enforcing CLAUDE.md's hard 60KB budget — is wired the same way and has the same gap.

Confirmed in day-always-on's cleanup-collapse commit (582d5c51): the commit message states plainly "CLAUDE.md compacted back under budget after a shell edit bypassed the write-time hook." A shell-routed edit pushed CLAUDE.md over its 61,440-byte budget without the hook blocking it (it would have, had the edit gone through Edit/Write), and the overage was only caught and fixed afterward by a manual compaction pass in the same commit.

This is the same root cause as the plan-document lesson, applied to a second concrete gate: `claude-md-budget.js` is a PreToolUse hook and PreToolUse hooks match on tool name (Edit/Write), not on which file is targeted or what the file's contents mean. Any file this project gates at write-time (CLAUDE.md, impl.md, brief.md, and any future gated document) is exposed to the same bypass whenever an agent reaches for `sed`, a Python/Bash heredoc, or any other shell-level write instead of the Edit or Write tool.

**Do**: edit CLAUDE.md (and any other hook-gated file) only through the Edit or Write tool, never a shell one-liner or heredoc — even for a small or mechanical change. If a shell edit to a gated file is unavoidable (e.g., in a script), check the gate's condition manually afterward in the same step, since the hook cannot do it for you retroactively.

See `.indusk/planning/day-always-on/impl.md` (Build Phase 8) and `/guide/context-budget`.
