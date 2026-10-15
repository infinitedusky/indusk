# A plan leaves draft only through `indusk plans approve`, and nothing is checked off on a plan that is not approved

In the workbench-plan-authoring live check (2026-10-06) the planning agent went on past the written plan: it set the impl `in-progress` by hand and started building, so `plans approve` — the brief and promise checks — never ran. The rule was only words in the planner skill.

`check-gates.js` now enforces it (small-fixes, 2026-10-08): a tool edit that moves an impl's `status:` off `draft` (to anything but `abandoned`) is refused, since `plans approve` writes the file itself with no tool event; and any checkbox checked off while the status is `draft` is refused, since a draft's checklist is the plan, not progress.

It also holds an approved plan whose brief has moved (brief-as-the-contract, 2026-10-12): while `indusk plans amendments <name>` lists a change since approval to an expectation, a promise or a look, or to a promise's statement the plan owns, no build item is checked off. Editing the impl, a note or a Shape finding is not an amendment and waits for nobody. A plan whose impl records no `approved_brief` was approved before the record existed and has none.

What to do: finish the plan, present it, and when the person approves run `indusk plans approve <name>`. Building is `/work`'s, after that. If the gate refuses you, you are in a planning session that has gone too far — stop and hand over. If it names amendments, stop and show them to the person: they approve them with Approve on the plan's page, or by running `indusk plans reapprove <name>` themselves; or put the brief back as it was approved. Never reapprove on your own.

promise: a-plan-builds-only-after-approval
