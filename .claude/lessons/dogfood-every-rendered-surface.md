# Dogfood every rendered surface when a shipped convention changes

# Dogfood every rendered surface when a shipped convention changes

When a convention change lands (new file format, new frontmatter key, new phase shape, new log schema), the code that PRODUCES the new shape usually ships with its change, but the code that RENDERS the new shape often lags — and the lag is invisible until someone views the output.

## The pattern

The `/falsify` phase-authoring flow shipped in 1.27.4 of indusk-mcp (plan: `falsify-phase-authoring`). Its brief explicitly flagged "Admin-UI styling for falsification phases" as out-of-scope. That decision was defensible at the time — the skill file + retrospective gate were the load-bearing changes.

But the admin UI is the primary reader interface for the plan's output. Users never look at raw impl.md files; they look at the rendered PlanDetail. "Out of scope" in the producer plan effectively meant "invisible until someone tries to view it." The gap was discovered the first time `/falsify admin-ui-hosting` ran — Phase 7 appeared in the main Phases list, the Falsification section said "No falsification ritual run for this plan," and the user immediately asked why.

Two follow-up patches landed in quick succession:
- **1.27.6** — admin UI falsification-aware rendering (PlanDetail hoists the falsification phase, renders trajectory rows as Hypotheses, renders post-phases as Follow-up Phases)
- **1.27.7** — CollapsibleSection state persistence (the user's second usability complaint while dogfooding the new rendering)

Both were discoverable in minutes of real use, but neither was in either plan's original scope.

## The lesson

When shipping a convention change, list every rendered surface that consumes the convention and decide per-surface: update now, update in a follow-up plan, or accept the gap with a visible reason. Don't rely on "out of scope" as the default — rendering gaps are invisible to grep and invisible to tests, but glaring to a human reader.

**Heuristic questions:**

- What are ALL the places that render output produced by this convention? (admin UI, docs site, CLI output, test reports, exported JSON shapes)
- For each: does the convention change require a rendering update, or does existing code still work?
- For rendering updates that can't happen in the same plan: who's on the hook for the follow-up, and how is it visible to them before the first production user hits the gap?

## When this comes up

- New frontmatter keys that change how a plan's status should display
- New log entry shapes (falsification, highlights, scorecards)
- New trajectory states or columns
- New file conventions (per-phase context gates, test-plan sections, etc.)
- New CLI flags that change output format

## Related

- `test-red-at-earliest-writable-phase.md` — tests that prove a convention works should live from the earliest phase where the convention is writable; the rendering surface deserves the same discipline.
- `verification-gates-need-adversarial-framing.md` — "would this gate pass for the wrong reason?" applies here too: "would this plan pass the rendering audit for the wrong reason, i.e., by never being viewed?"

