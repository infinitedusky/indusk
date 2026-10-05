# Planner Promises

Promises reached the registry only by someone typing a file, and nothing tied
a plan's brief to what the registry held, a test to the promise it proved, or
a closed plan to the promises it made. On numero a promise broke in the running
system while its one test stayed green, and nothing written connected the two.

Full ADR: `.indusk/planning/archive/planner-promises/adr.md`.

## What was decided

**The conversation is the input; the brief holds what came out of it.** A
brief is expectations (each with a measure and a time to look) and promises
(the ones the plan makes, and the existing ones it must not break, changes or
replaces). The problem, the context and the decisions go in research. One
parser reads the brief's shape, and a line it cannot read is refused by name.
See [Briefs](/guide/briefs).

**Commands write the registry.** `promises declare`, `change`, `replace` and
`withdraw`, and the planner's tools of the same names. The planner calls them
when the person accepts the brief, never before. A promise a later plan
improves keeps its name and its history; one whose name no longer fits is
replaced and retired when the replacing plan closes.

**Every test row says what it is for.** A `For` cell names the promise it
proves, the lesson it guards, or why it needs neither; a `Level` names one of
the five test levels (the word was "kind" in 1.61).

**One contract, three callers.** `promises contract` holds a plan's brief, its
rows and the registry to each other. The impl hook runs it on every write to an
opted-in impl past draft, and refuses when it cannot run it; `promises check`
runs it for every open plan.

**Closing confirms.** `promises confirm` makes each declared promise `enforced`
from the passing rows that name it and the code that carries its token, keeps
an in-force promise's links current, and retires what a promise replaces. It
refuses, writing nothing, while a promise is unproven. The retrospective runs
it, and its gate names what is unproven.

**An incident names its tests.** When a promise breaks, its incident lists
every row, in any plan, that named it.

## Tradeoffs accepted

- The impl hook needs an `indusk` on `PATH` (or `INDUSK_BIN`) that has
  `promises contract`. An older one refuses every write to an opted-in impl,
  and says why.
- A draft brief is not held by the sweep over every plan until its plan is
  building, so an unaccepted conversation does not turn every test run red.
- Expectations are never gated on their outcome. Building the telemetry they
  name, and reading it back, is a later plan.
- Whether code a plan touches belongs to a promise the plan did not name is not
  checked here: that is `day-contract`, the check at change time.
