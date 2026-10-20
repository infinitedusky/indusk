---
title: "Decisions as questions"
date: 2026-10-19
status: proposed
---

# Decisions as questions

## Goal

**An unattended session asks each choice as a question the person can see, goes ahead on its recommendation when the cost is low, and stops only when the cost is high.**

Today a session that meets a choice the plan does not settle either records it as "decided unattended" in a document (the person meets it only at approval, as in decisions 1–5 of the `the-admin-knows-the-package-root` test plan), or stops the whole run. The first hides decisions; the second makes runs stop for choices that did not matter. This ADR makes every such choice a visible question and lets its cost decide whether the run waits.

## Y-Statement

**In the context of:**
Unattended planning and build sessions run by the admin, which meet choices the plan does not settle and today either decide silently in a document or stop the run for the person.

**Facing:**
Two failures at once: decisions the person never saw until approval, and runs that stop for every judgement. Fixing forward must also stay safe: a timer must never settle what the person agreed (brief, promise, look, gate), a late disagreement must cost a plan rather than a stop, and the release, not landing, is where a known-wrong thing must be caught.

**We decided for:**
One question record per choice (options, a recommended option with its reason, a cost of cheap, moderate or expensive, a stored deadline, a state, and the answer and what was done), carried over the existing session `question` event and answered where decisions are answered today (Needs you and the plan's decision card). The admin, not the agent, fixes the cost: any option that changes the brief, a promise or a look, or skips a gate raises the question to expensive. A cheap question goes ahead after five minutes and a moderate one after an hour, both counted from a stored wall-clock deadline; an expensive one stops its session and frees its slot until answered. A late answer that differs from what was done opens one draft follow-on plan; `indusk release` refuses, naming each, while one is open, and landing never does. A save-time check refuses a document that records a choice as decided unattended without a question reference.

**And against:**
Letting the agent set its own cost unchecked; counting timers only while the admin runs; stopping on every question; never stopping, with a log read afterwards; a separate question store beside the plan's history; a gate on landing; a new answering surface; and opening a new follow-on per late answer.

**To achieve:**
Runs that stop only for what the person must decide, a person who sees every decision with its recommendation, and a wrong timed-out answer that becomes a draft plan the release will not forget.

**Accepting:**
A question can go ahead late when the admin was down at its deadline; a recommendation the person would have rejected can ship to main before they look (the follow-on and the release check are the repair, not prevention); and one more record type, one more save-time check and one release rule to maintain.

**Because:**
The brief's expectations are that runs stop less while the person still sees every decision, and main is not production: fixing forward on main and holding the release is cheaper than stopping every run, while the cost rule keeps what was agreed out of any timer's reach.

## Context

The research (`research.md`) records the starting point and Sandy's decisions of 2026-10-19: fix forward rather than stop; the release waits and landing does not; an expensive question stops its session and frees its slot; answer where decisions are answered today; review and acceptance stay stops, not questions; significance by what the answer changes. The brief (accepted) turns these into five promises and three looks. The test plan (draft) holds 51 assertions, six of its own decisions, and one open question it settled: the hour is wall-clock. This ADR formalizes those and records the shape the impl builds. The session protocol already carries a `question` event from `AskUserQuestion` (`lib/session/protocol.ts`), used by conversation sessions; `detectHumanGate` in `lib/build/judgement.ts` is where a declared judgement stops a build today.

## Decision

Each decision was made unattended (`INDUSK_GATE_POLICY=auto`); the reason is given with it for the reviewer.

1. **One question record, extending the session `question` event.** A record holds id, plan, options (at least two), the recommended option and its reason, the agent's stated cost, the effective cost, the deadline, state (`waiting`, `answered`, `went-ahead`, `answered-late`), the answer, what was done, and the follow-on plan if one was opened. Questions from an unattended session use it; a conversation session with the person present keeps asking as it does today, with no cost and no timer (A49). Reason: the protocol event already reaches the admin; a second channel would be a second place to look.
2. **A malformed question is refused to the session, not shown.** Fewer than two options, no recommendation, no reason, or a cost outside the three is returned to the session with what is missing (A2). Reason: the person should never be asked a question with no recommendation to accept.
3. **The admin fixes the effective cost.** The agent states a cost; the admin raises it to expensive when any option changes the brief, a promise or a look, or skips a gate (A17–A19). It never lowers one. Reason: the brief makes this independent of the agent's judgement. Detection is by what an option declares it touches (a structured `changes` list on the option: `brief`, `promise`, `look`, `gate`), not by reading its prose; a question whose options declare nothing keeps its stated cost. The cost: an agent that omits the declaration under-classifies, and the expectation on timed-out wrong answers (U2) is where that shows.
4. **Deadlines are stored wall-clock times, and every cost holds by default.** Each cost's wait is a setting under `sessions.question_wait` (`hold`, a number of minutes from the moment the question is recorded, or `immediate`); with nothing set every cost holds until answered (amended 2026-10-19, Sandy: answer everything first, then decide what to automate). A question that would change what was agreed holds whatever the setting. The admin acts on a question when it reads one past its deadline, so a restart never gives more time and a down admin makes a question go ahead late, not early (A7, A8, A10). This settles the research's open question. Reason: a person who leaves for an hour expects an hour.
5. **Going ahead means the session is told to continue with the recommendation, and the row says so.** The record is marked `went-ahead` with the time and what was done (A9). A timer never approves anything: it only picks the recommended option, and an option that would need approval is by rule 3 expensive (A38).
6. **An expensive question stops its session and frees its slot.** The plan is listed under Needs you with no timer; the machine counts one fewer running session; the run resumes with the answer when the person gives it (A12–A16). A plan waiting on a timer still holds its slot (A39). Reason: with no graph yet (`run-the-graph` narrows this later), the whole session is the unit that can wait.
7. **Answers are given where decisions are answered today.** Needs you and the plan's decision card show each open question as a question row, expensive first; the reply is words, an empty reply is not an answer (A51), and the answer is recorded in the plan's history like any decision (A29). No new surface. Three new looks (`question-row.cheap`, `.expensive`, `.went-ahead`) and the changed `plan.needs-you` are approved by a person as mockups before the build.
8. **A late answer that differs opens one draft follow-on plan.** Late means after the question went ahead; an answer matching what was done opens nothing (A22), an answer before the timer is simply used (A24). The draft's brief names the question, the choice made and the one wanted; it is never accepted, approved or started by the answer (A25). A second answer to the same question updates that plan rather than opening another (A23): the plan is found by the link stored on the question record. A late answer that changes the brief still stops for re-approval, carried by the follow-on (A37). The follow-on is opened beside, not instead of, the bugfix plan an unclaimed failure opens (A41).
9. **Every question stays.** The record is kept in the plan's history in all four states and survives landing and archiving (A27, A28). Reason: the follow-on, the third expectation and the person's trust all read it.
10. **A save-time check enforces "never decided silently".** A document written by an unattended session that says "decided unattended" for a choice without a question reference is refused at save, naming the line; the same line with a reference to a question that exists in the plan's record saves, and a made-up id is refused (A4, A5). Review and acceptance are not questions and are not checked (A50). Reason: a rule an enforcer delivers is kept; a rule in a skill is not.
11. **The release refuses; landing never does.** `indusk release` reads the planning folder and refuses, naming each, while any plan opened as a follow-on by a disagreeing answer (marked in its frontmatter) is open; closed means landed, abandoned or archived. An ordinary plan never blocks (A30–A33). Landing is untouched, including landing the follow-on itself (A35, A36). The step is a named workflow step, release by default, so a project whose main deploys can move it to the pull request; only the default is built and tested here. Reason: main is not production, the release is.

12. **An unattended session asks through a structured tool, `ask_decision`, on the indusk MCP server.** `AskUserQuestion`'s input has no place for a recommendation, a reason, a cost or what an option changes, so the fields cannot ride on it. `ask_decision` takes exactly the record's fields; its permission request reaches the admin as the same kind of event and becomes the record (decision 1). In an unattended build or planning run a plain `AskUserQuestion` is still refused, now with a message naming `ask_decision`; this changes `refuseBuildQuestion` and the build's prompt, which today say nobody will answer. Added by the before-approval plan review (findings 1 and 2 in `plan-review.md`).
13. **A follow-on is never dead-archived.** `plans archive-dead` skips a plan with `follow_on_of`, so an untouched follow-on stays open (and the release keeps refusing) until a person lands, abandons or archives it by hand. Reason: otherwise the age limit would close it with nobody deciding.

## Alternatives Considered

### Carry the fields in `AskUserQuestion`'s option text
No new tool. Rejected: cost and what an option changes would be prose the admin must read, which decision 3 rules out, and the schema would not validate them.

### Trust the agent's stated cost
Simplest, and the agent knows the most. Rejected: an agent that mislabels a brief change as cheap would let a timer settle what was agreed, which the third promise forbids outright. The check has to sit outside the judgement it checks. Rejected against A17–A20.

### Count the hour only while the admin runs
Avoids a question going ahead late after a restart. Rejected: each restart would give a question a different length, and the wait would stop meaning what the person was told. A stored deadline gives one rule (A10). The research left this open; it is closed here.

### Stop on every question
Safest for correctness. Rejected: it is today's behaviour and the first expectation (runs stop less) fails. Most choices are cheap or moderate and recoverable by a follow-on.
*Amended at close (2026-10-19):* the built default is hold for every cost (decision 4, the amendment before the build), so every question stops its session. This rejection still holds for the first expectation; the stale text is now corrected here, not the code.

### Never stop; decide everything and show a log afterwards
Fastest. Rejected: an expensive choice (a changed look, a skipped gate) cannot be repaired by a follow-on after the fact, and the person would learn of it only after the work was built on it.

### A separate question store, outside the plan's history
Cleaner for querying. Rejected: the history is already where answered decisions are recorded and read by the admin, and a second store is a second place for a question to be lost (A27–A29).

### Gate landing on open follow-ons
Strongest guarantee. Rejected by Sandy's decision: it would stop the flow that fixing forward exists to keep, and a follow-on is the repair for something already on main, which is not production. The release is the gate (A35, A36).

### A new answering surface for questions
Rejected by Sandy's decision: Needs you and the decision card are where decisions are answered today; a new surface splits attention. The looks change, the place does not.
*Amended at close (2026-10-19):* the built admin has a second answer route (`api/plans/[name]/question`) and a question-row block beside the decision card, which is hidden for recorded questions. The route is reachable and not removed; see the retrospective's audit disposition.

### One follow-on per late answer
Rejected: a person who answers twice has changed their mind, not asked for two plans (A23).

### Document-only rule for "never decided silently"
A line in the planner skill telling the agent to ask. Rejected: this is how it already fails; an enforcer at save (rule 10) delivers the rule where it applies.

## Consequences

### Positive
- Runs stop only for expensive questions, judgements and blockers; cheap and moderate choices proceed on a timer.
- No choice is recorded without a question; the person sees every decision with a recommendation.
- A wrong timed-out answer becomes a draft plan and a release refusal, not a silent defect.
- Waiting plans on expensive questions free their slots.

### Negative
- A recommendation the person would reject can reach main before they look.
- A question can go ahead late when the admin is down.
- One record type, one save-time check and one release rule to carry.

### Risks
- **An agent under-declares what an option changes**, leaving an expensive question cheap. Mitigation: the third expectation (follow-on plans per timed-out question, under one in ten) and U2 watch it; a rule raising a question to expensive on a document or file path the option names is the next step if it shows.
- **Questions pile up unread and timers settle them all.** Mitigation: every went-ahead question stays on the page with its row, and a late answer repairs it.
- **The release check blocks on a follow-on nobody will do.** Mitigation: abandoning or archiving a follow-on closes it, so the person can always clear it by deciding.
- **The save-time check refuses legitimate text** that happens to say "decided unattended". Mitigation: the reference form saves, and the refusal names the line.

## Documentation Plan

### Pages
- New: `decisions/decisions-as-questions.md` (ADR published).
- New: `guide/questions.md` — what a question is, the three costs and what each does, how to answer, what a late disagreement does.
- Update: `reference/cli/release.md` — the refusal while a follow-on is open, and the workflow step that moves it.
- Update: the admin pages' reference where Needs you and the decision card are described, and the `sessions` config keys for the two waits.

### Diagrams
- A state diagram of a question (waiting → answered / went-ahead → answered-late → follow-on), Mermaid in `guide/questions.md`.

### Changelog
- Added questions for unattended sessions: cheap and moderate ones go ahead on a timer, expensive ones wait; a late disagreement opens a follow-on plan the release waits for.

### ADR in Docs
- Yes: `decisions/decisions-as-questions.md`.

## References
- `.indusk/planning/decisions-as-questions/research.md`, `brief.md`, `test-plan.md`
- `.indusk/planning/run-the-master/master.md` (the master this is child 2 of)
- `.indusk/planning/audit-concerns-are-answered/` (source of "significance by what the answer changes")
- `apps/indusk-mcp/src/lib/build/judgement.ts`, `apps/indusk-mcp/src/lib/session/protocol.ts`
