# Edit plan documents with Edit/Write, never a script

InDusk's plan-gate hooks are PreToolUse hooks on Edit and Write only. A subagent that changes `.indusk/planning/**/impl.md` through Python, sed or another shell script skips every gate (phase order, checklist rules, budget) and nothing notices. Seen in sessions-per-plan, where early subagents rewrote impl.md with Python. When briefing a subagent that will touch plan documents, say explicitly: use Edit/Write only.
