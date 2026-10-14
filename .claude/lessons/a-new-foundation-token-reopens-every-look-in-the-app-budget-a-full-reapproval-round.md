# Adding one foundation token changes the foundation hash and reopens every story and mockup in the app — a plan that adds a token budgets a full re-approval round, or batches its tokens first

cockpit-redraw added `--size-nav-max` to `foundation.tokens.json`. Approvals bind to the foundation's hash, so every story and mockup in the admin read proposed afterwards: `indusk looks lint admin` reported 122 `no-approved-story` findings, and about 113 approval entries were recorded again on looks the plan never named (chip.*, step.*, dashboard.*, promise-row.* …). That is a full re-approval sweep for one number, and it works against the brief's expectation that each look is approved about once per plan.

Why: the foundation is one input to every rendered look, so a change to it is global by design (the ui-promises decision), not local to the component that wanted the token.

What to do: when a plan needs a new token, (1) say in the brief or impl that a full re-approval round is expected and by whom, (2) make all the plan's foundation edits in one change, early, before any look is approved, so the sweep happens once, and (3) check whether an existing token already does the job. Do not add a token mid-build after looks have been approved without telling the person what it will reopen.

See `.indusk/planning/cockpit-redraw/retrospective.md` and `/decisions/ui-promises`.
