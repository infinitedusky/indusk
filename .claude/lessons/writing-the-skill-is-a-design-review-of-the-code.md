# Writing the skill's steps is a design review of the code — it finds gaps the ADR never surfaced

In planner-promises, spelling out the planner skill's conversation steps in prose — what the agent asks, in what order, what it does with each answer — surfaced two problems the ADR never named: a draft (unaccepted) brief's promises are not yet saved to the registry, so the sweep over every plan must skip drafts or every unfinished conversation turns the suite red; and there was no `promises withdraw` command for a promise declared and then dropped, which could then only leave the registry by deleting its file by hand.

Why it matters: an ADR describes the shape of the mechanism; a skill describes what an agent actually does, step by step, in order, with every input it might get. Writing the second forces you to enumerate cases the first could stay silent about — an ADR can say "the planner asks what this plan promises" without ever considering what happens to a promise nobody finished agreeing to.

What to do: don't treat skill-writing as a mechanical translation of an already-settled design. Write it early enough, and carefully enough, that it functions as a second design pass — and expect it to find real gaps, not just wording issues. See `.indusk/planning/archive/planner-promises/retrospective.md`, "What We Learned".
