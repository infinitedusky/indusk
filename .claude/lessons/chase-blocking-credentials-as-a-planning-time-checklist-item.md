# A live check against a deployed system must name where its credential lives at planning time, not discover it mid-build

In the incident-recording plan, A6 (the live check against the deployed always-on server) stalled because the server's password was a write-only Fly secret that no machine held a copy of — it had to be rotated and stored in Doppler (`indusk/prd` as `INDUSK_SERVER_PASSWORD`/`INDUSK_JAEGER_CREDENTIAL`) mid-plan, with the operator's go-ahead.

Why: an ADR or brief that says "the live check hits the deployed server" without naming the actual credential and where it is retrievable leaves a blocking dependency undiscovered until someone tries to run the check — at which point it becomes an unplanned mid-build detour (and in this case, a security-sensitive one requiring a human decision to rotate a secret).

How to apply: when a plan's trajectory includes a live check or contract test against a real deployed system, add a Phase 0 (or earliest-possible) checklist item that names the specific credential, confirms it is retrievable by the agent/operator doing the check, and if not, rotates/provisions it before the check's build phase — not ambient hope that it'll be there when needed.
