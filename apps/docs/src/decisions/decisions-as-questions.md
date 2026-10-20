# Decisions as questions — an unattended run asks, and the cost sets the wait

**Decided 2026-10-19.** Full ADR: `.indusk/planning/decisions-as-questions/adr.md`.

## Goal

**An unattended session asks each choice as a question the person can see; each cost's setting says whether an unanswered question waits or goes ahead; and only a question that would change what was agreed always waits.**

Before this, a session that met a choice the plan did not settle either recorded it as "decided unattended" in a document — which the person met only at approval — or stopped the whole run. The first hides decisions; the second stops runs for choices that did not matter.

## Y-Statement

**In the context of:** unattended planning and build sessions run by the admin that meet choices the plan does not settle,

**Facing:** decisions the person never saw until approval, and runs that stopped for every judgement; any fix must keep a timer from ever settling what the person agreed, make a wrong timed-out answer cost a plan rather than a stop, and hold the release, not landing, to account,

**We decided for:** one question record per choice (options, a recommendation with its reason, a cost, a stored deadline, a state, the answer and what was done), asked through a structured `ask_decision` tool; the admin fixing the cost from what each option declares it changes; **one setting per cost** (`hold`, minutes or `immediate`, **hold by default**); a held question ending its session and freeing its slot; a late answer that differs opening one draft follow-on plan; `indusk release` waiting for open follow-ons while landing never does; and a save-time check refusing "decided unattended" with no question reference,

**And against:** trusting the agent's stated cost, counting timers only while the admin runs, stopping on every question, never stopping, a second store beside the plan's history, a gate on landing, a new answering surface, and one follow-on per late answer,

**Accepting:** a question can go ahead late when the admin was down at its deadline, and a recommendation the person would have rejected can reach main before they look — the follow-on and the release check are the repair, not prevention.

## Amended before the build

The proposed ADR gave cheap and moderate questions fixed waits of five minutes and an hour. The person amended it (2026-10-19): **answer everything first, then decide what to automate**. Every cost holds by default, and `sessions.question_wait.cheap | moderate | expensive` set each cost's wait. A question that changes what was agreed holds whatever the settings say.

## Where it lives

`lib/questions/` in the package owns the rules (record, cost, deadline, sweep, history, follow-on); the build path records a question instead of refusing it; the admin shows question rows on the plan's page. See [Questions](/guide/questions) and [`indusk release`](/reference/cli/release#waiting-for-a-follow-on).
