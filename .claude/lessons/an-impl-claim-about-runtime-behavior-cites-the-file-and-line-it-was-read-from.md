# An impl's claim about what code does at run time cites the file and line it was read from — an unattended impl otherwise states unread facts

The a-run-can-be-trusted plan review (plan-review.md, 21 findings) found an unattended impl asserting facts about code it never opened: which pid a run owns, that `plans land` keeps the branch, that the recorder loop writes a tick record, that the retrospective archives without `mv`, where the approval offer is decided. Each was a design premise, so a wrong one would have built the wrong fix.

Rule: every sentence in an impl or test plan that states what existing code does at run time carries `path:line` from a read in the same session. A claim that cannot cite one is written as an open question, not a fact.

Why: an unattended author has nobody to ask, and plausible-sounding claims about neighbouring code read as established once written down. The cold-read plan review is what caught it; a citation lets the reader check in seconds.

See .indusk/planning/a-run-can-be-trusted/plan-review.md; highlight h-20261019-028.
