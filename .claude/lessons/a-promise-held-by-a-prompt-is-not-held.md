# A promise an agent could break is held by code and marks, never by its prompt

If an agent session can break a promise (write outside its folder, run `gh`, publish), telling it not to in the prompt does not keep the promise. Confine what the session may do in code (its permission decision) and mark the promise where it would break, so a break is seen in use.

Why: new-project-flow's audit found three promises (nothing on disk if abandoned, nothing published unasked, nothing outside the parent) held only by the prompt while the conversation's agent could run any shell command. Nothing had gone wrong — nothing would have shown it if it had.

How to apply: when a plan gives an agent a session, decide its tool confinement in the same phase, and list each promise it could break with the mark that would catch it.
