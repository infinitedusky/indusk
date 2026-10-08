# A plan leaves draft only through `indusk plans approve`, and nothing is checked off on a plan that is not approved

In the workbench-plan-authoring live check (2026-10-06) the planning agent went on past the written plan: it set the impl `in-progress` by hand and started building, so `plans approve` — the brief and promise checks — never ran. The rule was only words in the planner skill.

`check-gates.js` now enforces it (small-fixes, 2026-10-08): a tool edit that moves an impl's `status:` off `draft` (to anything but `abandoned`) is refused, since `plans approve` writes the file itself with no tool event; and any checkbox checked off while the status is `draft` is refused, since a draft's checklist is the plan, not progress.

What to do: finish the plan, present it, and when the person approves run `indusk plans approve <name>`. Building is `/work`'s, after that. If the gate refuses you, you are in a planning session that has gone too far — stop and hand over.

promise: a-plan-builds-only-after-approval
