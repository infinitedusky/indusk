# An enforcement gate covers tool surfaces, not intentions — unrouted mutating tools are a hole by construction

When wrapping an agent with a gate that inspects/blocks tool calls (a PreToolUse hook, a tool-approval envelope, any per-edit enforcement layer), the gate only sees the tool surfaces it's explicitly wired to inspect. Any other tool that can mutate the same state is a hole in the enforcement, by construction — not a bug in the gate's logic, but a gap in its coverage.

**The concrete case:** dawn-external-orchestrator's edit-tool gate correctly refused disallowed edits, but its falsification ritual found that a `bash` tool call could rewrite the same checklist checkboxes the edit gate would have refused — and the gate **failed open**: silence (no exit-2, no explicit denial) was read as permission. The orchestrator loop was routing `Edit`/`Write` through its gate envelope but not `Bash`, even though both can mutate the same files.

**The fix pattern:**
1. Every tool that can mutate the governed state must be routed through the same `{tool_name, tool_input, cwd}` gate envelope — there is no such thing as a "safe" tool surface once any mutating path exists outside the gate.
2. The invoker must fail **loud**, not silent: exit 2, any other non-zero exit, and a timeout must all block. An unattended/autonomous loop must never interpret the absence of an explicit denial as permission — that is exactly the failure mode that let bash slip through.
3. Treat this as a checklist item whenever building or extending an agent-wrapping enforcement layer: enumerate every tool the agent can call that mutates state, and verify each one is routed through the gate — don't assume coverage from the tools you remembered to wire.

**Why it generalizes:** this is not specific to dusk's trajectory/checklist gates — it applies to any system that puts a policy layer between an autonomous agent and a mutable resource (file system, database, API). The gate's blast radius is exactly the set of tool calls it inspects; anything outside that set is ungoverned regardless of how rigorous the governed path is.
