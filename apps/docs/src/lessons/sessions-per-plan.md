# Sessions per plan — Lessons

From [sessions-per-plan](/decisions/sessions-per-plan), which made a session belong to its plan and capped the machine's sessions.

## A limit's promise is the total, not the refusal

The cap's rows asserted that a start at the cap is refused. Falsification then found a build losing its place between steps, and the fix (an `inBuild` opt-out) passed its own row while letting several builds exceed the cap. Only a cold-reader audit asked whether the total can exceed `max`. Write the aggregate invariant as a row beside the promise, before the first fix.

## A fix for a falsification finding is new, untested behaviour

The row that proved the bug gone said nothing about what the fix broke. Treat the fix as code that needs its own question: what promise does this now violate?

## Edit plan documents with Edit and Write, never a script

The gate hooks watch Edit and Write only. Early subagents edited `impl.md` with Python scripts, so no plan gate ran on those edits. Say so in every subagent brief that touches `.indusk/planning/**`.

## A button added mid-build is a look

The brief said Looks: None; a "Continue it here" button was added on request. A small conversational change to what a person sees is still an amendment to the brief. Also, a refusal worded as a question needs an answer everywhere it appears: two pages show it without a button.
