# A plan whose subject has states lists how each transition can fail, and gives every failure a row or a signal

When a plan introduces a record that moves through states (a question: waiting, answered, went-ahead, answered-late), the trajectory tends to cover the happy path of its life and none of its failure paths. List each transition and ask what happens when it fails, then give each failure a trajectory row or a signal.

Why: the decisions-as-questions audit (h-20261019-040) found, after all rows were green, that a session can die while a timed question waits (the answer 409s and the sweep later marks it went-ahead with no run), a restart refused at sessions.max is swallowed, a failed history write tells the session to decide silently (against its own never-decided-silently clause), and a planning-run resume was keyed on the words "asked a question". None had a row.

How to apply: at test-plan time write a transition table (from state, to state, trigger, how it fails, what the person or a signal sees). A failure that is swallowed or reported only as text needs a named signal, not just a catch. See the existing lessons list-every-path-to-a-behaviour-before-planning-it and trajectory-rows-must-drive-the-path-a-person-takes-not-the-function-it-calls; this one adds the failure side of each transition. Source: .indusk/planning/decisions-as-questions/audit.md.
