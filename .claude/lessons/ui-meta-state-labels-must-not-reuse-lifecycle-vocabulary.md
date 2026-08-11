# UI labels for meta-states must not reuse existing lifecycle/domain vocabulary

When a UI needs a label for a state that isn't a real lifecycle stage — e.g. a placeholder card for a plan that's declared but not yet created — don't reuse a word that already means something specific elsewhere in the domain's vocabulary. dawn-ui-plan-grouping's admin sidebar originally labeled greyed placeholder entries "planned", which collided with plan-lifecycle/trajectory vocabulary (research → brief → ADR → impl are the real stages) and implied the placeholder was sitting at a specific, existing lifecycle stage it wasn't — a declared-but-uncreated subplan isn't "at the planned stage," it just doesn't exist as a folder yet.

**Why it matters:** the user caught this by inspection, not by a failing test — vocabulary collisions like this are semantically wrong but structurally valid, so they pass every test and render cleanly. They mislead a reader who knows the domain's real vocabulary into inferring a stage/status that isn't true.

**Fix applied:** renamed to "queued" everywhere the label rendered (UI + docs), a word with no prior meaning in the plan-lifecycle vocabulary. Before naming any new UI state, grep the domain's existing enum/vocabulary (plan stages, trajectory states, badge variants) for the candidate word and pick one that doesn't already mean something else.
