# Subagent tool calls fire — and are blocked by — the session's PreToolUse hooks

Empirically verified (work-autopilot spike, 2026-07-25): a Task/Agent-tool subagent's `Edit`/`Write` triggers the project's `.claude/settings.json` PreToolUse hooks, and a hook that exits 2 **denies the subagent's edit** and feeds the denial back to the subagent — identical to the main session.

**Why it matters:** any InDusk feature that orchestrates work through subagents (autopilot phase-loops, parallel reviewers, spawned executors) inherits the gate rails for free. A subagent cannot skip test-first-RED, cannot check off a phase whose trajectory rows aren't green, cannot write an over-budget CLAUDE.md — the hooks enforce structure regardless of who makes the tool call. Build orchestration thin: inherit enforcement, don't re-implement it.

**Caveat:** hooks enforce *structure* (test authored red-first, gates terminal, budget). They do NOT prevent a subagent from editing *content* it's allowed to touch — e.g. weakening a test's assertion text or moving a trajectory `Passes at` later to fake green. Guard that separately (forbid trajectory/test-assertion edits by contract; snapshot-and-verify the trajectory across the phase).

**How to verify hook behavior in a session:** register a throwaway PreToolUse Edit|Write hook that logs the tool call (and optionally exits 2 on a sentinel path), spawn a subagent that writes a uniquely-named file, and check the log / whether the write was blocked. Positive-control with a main-session write first to confirm the registration is live without a restart.
