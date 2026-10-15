# Before relying on a callback to persist a log, read who actually writes the file — it may be a subscriber, and a flag that skips the callback may still persist

Build Phase 1 of decided-prompts-stay-closed assumed a draft's transcript.jsonl is appended through the manager's `opts.onEvent`, and that `record(..., forward=false)` would therefore keep rule-decided requests out of it. In fact `new-project-session.ts` writes it from a `subscribe()` listener, and `forward=false` still notifies listeners — so rule-decided requests and their decisions are persisted anyway. The plan's unchecked item "confirm by reading startProjectConversation" caught the wrong assumption; the audit then noted that persistence depends on that untouched subscriber staying in place.

Rule: when a change alters which events reach a callback or a listener, find the code that writes each persisted log (grep for the file name) and state in the plan which path writes it. Do not infer it from the option's name.

Pointer: .indusk/planning/decided-prompts-stay-closed/impl.md, Build Phase 3 "what the falsification looked at"; audit.md "What else would have to change".
