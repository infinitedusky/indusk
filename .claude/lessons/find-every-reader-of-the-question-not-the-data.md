# When a new fact becomes the judge of a question, find every reader of the question, not every reader of the data

admin-plan-type made a plan's declared type (`workflow:`) the judge of whether an absent document matters. The type was wired into the one function that reads which documents exist. But four places answer "what comes next for this plan": the bar's segments, the bar's label, the plan list's next step, and the `advance_plan` MCP tool. Three had never heard of the type — a bugfix with an accepted test plan was told to write the ADR by a tool standing next to a bar that drew the ADR as skipped. Falsification found two; the third was found by accident.

**Rule:** searching for readers of the *data* (who reads `workflow:`) finds the site you already know. Search for readers of the *question* (who says what a plan needs next, who decides a document is finished) — grep for the answer's output text, the ordering constant, the status words — and list them in the brief before implementation. Each one either reads the new fact or is a contradiction waiting to be noticed.

**Corollary:** once the question has one definition, pin it with a source-tree scan, and check the scan's glob covers every directory a copy could live in. The existing pin read `src/lib` and reported one definition while `src/tools` held two more.

