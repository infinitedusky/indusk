# A decision record carries what the person chose, not only that they chose — a reload shows only the record

In decided-prompts-stay-closed, the `decided` event first recorded a person's answer to a question as plain `allow: true`. The chosen answers lived only in component state, so after a reload an answered question showed every option disabled and nothing chosen — it looked unanswered. Falsification caught it; the event now carries `answers`.

Rule: when a view must show an outcome after a reload or reconnect, the stored event has to hold the outcome itself (the picks, the reason, the message), not just a boolean. Check each kind of decision (tool allow/deny, question answer, rule decline) for what a reader needs to redraw it from the log alone.

Pointer: .indusk/planning/decided-prompts-stay-closed/impl.md, Build Phase 3 (falsification); apps/indusk-mcp/src/lib/session/start.ts `decided` event.
