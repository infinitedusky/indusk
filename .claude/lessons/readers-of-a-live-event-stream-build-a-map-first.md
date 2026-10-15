# A reader of the live event stream builds a map of the whole list first — never assume a decision arrives after its request

SessionManager.record calls the starter's onEvent before it notifies listeners. When the starter replies synchronously (a build's build-session.ts does), a live subscriber hears the `decided` event before the `permission` it decides, while the stored log replayed to a reconnecting panel is in order.

Today's readers (`decisionsOf`, `turnsOf`) build a request-id map from the whole event list first, so order does not matter. A future incremental reducer that reads events in arrival order would treat the permission as undecided.

Rule: read a request's decision by looking it up in a map built from all events, never by position or arrival order. If an order-sensitive reader is ever needed, fix the manager's ordering first (record the request before calling the starter).

Pointer: .indusk/planning/decided-prompts-stay-closed/impl.md, Build Phase 3 "what the falsification looked at"; audit.md "What does the diff change that no row touches?".
