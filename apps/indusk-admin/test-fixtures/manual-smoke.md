# T15 — Manual smoke procedure (outsider 30-second identification)

The "outsider 30s" check is the only test in the indusk-admin-ui trajectory that can't be automated. It's a usability smoke: someone unfamiliar with the project should be able to look at the admin UI and within 30 seconds correctly identify three things.

## Setup

1. Pick an "outsider": someone who hasn't worked on InDusk recently. Anyone unfamiliar with the project's plan structure works — a coworker, a friend, a partner. They should know what software development is, but NOT what "trajectory" or "phase gate" means in this codebase.

2. Pick a project to demo. Two are required for plan completion:
   - **dusk** itself: `cd ~/code/sandbox/dusk && indusk ui`
   - **Numero** (generalization smoke): `cd ~/code/sandbox/numero && indusk ui`

3. Open the URL printed to stdout (browser auto-opens by default; `--no-open` to suppress).

## The check

Hand the laptop to the outsider. Say only:

> "This is a tool for tracking software-engineering plans. Tell me three things: (1) which plan is currently being worked on, (2) which phase that plan is in, and (3) one passing test row vs one failing or in-progress test row."

Start a stopwatch. Don't help them; let them explore.

## Pass criteria

**PASS** if all three are true:
- They identify all three correctly (active plan, active phase, one passing row + one failing/blocked row)
- They do it in under 30 seconds
- They DON'T need you to explain what a "trajectory" or "phase" is — the visual hierarchy + color coding should make it obvious

**FAIL** if any:
- They take longer than 30s
- They misidentify the phase or which row is passing
- They ask "what does the green badge mean?" or "what's a phase?" before identifying

## After the check

If FAIL, capture:
- Which step they got stuck on
- What they expected to see instead
- What they said out loud while exploring

That's data for v2's UX changes.

If PASS on dusk and PASS on Numero, T15 is satisfied; mark `passing` in the trajectory table.

## Why this is manual, not automated

Automated UI tests can verify "the green badge with text 'passing' is in the DOM" but they cannot verify "an outsider perceives the phase as visually obvious." The check is intentionally about the human-in-the-loop signal that v1 reaches its design goal.

Per `apps/indusk-docs/src/reference/admin-ui/component-conventions.md`, the visual discipline (color-coded Badge variants per trajectory state) IS the enabling design — the test verifies it works in practice, not in spec.

## Recording the result

Once you've run the smoke on a project, add an entry to this file under "Smoke runs":

```markdown
- 2026-04-19, dusk, outsider: <name>, time: 22s, identified: 3/3, PASS
- 2026-04-19, numero, outsider: <name>, time: 18s, identified: 3/3, PASS
```

## Smoke runs

(populated as the smoke is run before plan archive)
