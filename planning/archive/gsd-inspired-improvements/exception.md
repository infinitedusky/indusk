read this and tell me what should be done:

Brief: Enforce Plan Execution Gates via InDusk MCP
Problem
During the poker-agent-runner-1 implementation, all 7 phases were executed without calling advance_plan once. Verification items were partially skipped, CLAUDE.md context updates were skipped for 6 of 7 phases, and no documentation items were addressed. The impl checkboxes were edited directly, bypassing the gate system entirely.

What Happened
The work skill instructions say:

Complete implementation items
Complete verification items (typecheck, lint, test, build)
Complete context items (CLAUDE.md edits)
Complete document items (docs pages)
Call advance_plan to validate all gates before moving to the next phase
What I actually did:

Complete implementation items
Run typecheck (partial verification)
Edit impl.md to check off items
Move to next phase
Steps 3-5 were skipped because nothing enforced them. The advance_plan tool is opt-in — it's called by the agent, and the agent chose not to call it. The skill text says "REQUIRED" but that's an instruction to the agent, not a system constraint.

Why It Was Possible
Three things made skipping easy:

impl.md is directly editable — I can write - [x] to any checkbox at any time. No validation runs when I edit the file.

advance_plan is a tool I call voluntarily — it's not injected into the flow. The work skill tells me to call it, but if I don't, nothing happens. There's no hook that intercepts my edit to impl.md and says "did you call advance_plan first?"

Phase transitions aren't gated — I can read Phase 2 items and start working on them without any check that Phase 1's gates passed. The skill says "do not advance" but the tools don't enforce it.

Proposed Fix
A Claude Code hook that fires when impl.md is edited to check off an item. The hook calls advance_plan and blocks the edit if gates aren't met.

Specifically:

Post-edit hook on **/impl.md: when an impl.md file is modified, detect if a checkbox was changed from - [ ] to - [x]. If so, call advance_plan for the current phase. If advance_plan returns incomplete gates, reject the edit with a message listing what's missing.

Phase boundary detection: advance_plan already knows which phase is active and what items remain. It returns a pass/fail with the list of unchecked verification, context, and document items.

The hook message should be specific: "Phase 3 cannot advance: verification item 'pnpm typecheck passes' is unchecked, context item 'update CLAUDE.md' is unchecked."

This turns advance_plan from opt-in to mandatory. The agent can't check off items without the gate validating first.

What InDusk MCP Needs
The hook infrastructure exists in Claude Code (settings.json hooks). What's needed from InDusk:

advance_plan should accept a phase number and return a structured pass/fail with missing items
A hook script (shell or node) that indusk-mcp provides, installable via npx @infinitedusky/indusk-mcp hooks install
The hook intercepts impl.md edits and calls advance_plan via the MCP protocol or a CLI command
Alternative: Lighter Enforcement
If full hook enforcement is too complex, a lighter version:

The work skill includes a mandatory step: "After checking off any item, paste the output of advance_plan in your next message." The user can see whether it was called.
advance_plan output is visible in the conversation, so the user can spot when it's missing.
This is weaker but doesn't require hook infrastructure.