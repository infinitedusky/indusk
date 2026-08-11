# validate-impl-structure.js and check-gates.js vacuous-pass an impl with zero parseable Phase headers

If an impl.md is authored with the wrong phase-header level (e.g. `## Phase N` instead of the required `### Phase N` + `#### Phase N Gate`), the trajectory parser finds zero phases — and both `validate-impl-structure.js` and `check-gates.js` silently pass, because "nothing to validate" and "nothing invalid" look identical to a parser that just counts matches. The impl then runs with checklist items getting checked off and NO real gate enforcement: no test-first-RED check, no trajectory-terminality check, nothing.

Found 2026-07-26 building dawn-external-orchestrator under `/work --autopilot`: Phase 0 ran entirely ungated before the format bug was caught and the impl reformatted (6 phases + 18 gate subsections then parsed correctly).

**Why it matters:** this is a silent-failure mode in the validators that are supposed to be the hard backstop for structural discipline (see `/decisions/tests-first-planning`). A parser that returns 0 results on malformed input must not be treated as "nothing to enforce" — for any impl with `trajectory: required` or non-empty checklist items, 0 parsed phases is itself a validation failure and must be rejected loudly, not passed vacuously.

**Fix (queued, not yet shipped as of this lesson):** in `apps/indusk-mcp/src/lib/trajectory/` (and its JS hook ports `validate-impl-structure.js` / `check-gates.js` — change both together per the existing mirror-parity gotcha), reject an impl that has `trajectory: required` or checklist items but parses to 0 `### Phase N` headers, rather than exiting clean.

See `.indusk/planning/indusk-v2-dawn/` (Dawn v1 build) for the discovery context and `.indusk/current.md` Session 80563054 for the fuller cursor note.
