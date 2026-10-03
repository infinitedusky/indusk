# auditPlanAtClose (Deferred Verification Audit) only reads a mitigation's first line, and misclassifies any line mentioning "plan" as a downstream-plan reference

context-tiers' retrospective (`.indusk/planning/archive/context-tiers/retrospective.md`, Deferred Verification Audit) found two defects in `auditPlanAtClose` (`apps/indusk-mcp/src/lib/trajectory/audit.ts`), the function the retrospective skill's Deferred Verification Audit step runs over a plan's `impl.md`:

1. When a Deferred Verification row's `mitigation:` field is a wrapped (multi-line) value, the auditor reads only the first line. Both of context-tiers' U1/U2 mitigations were multi-line and both were flagged "vague" by the tool until manually collapsed to a single line — not because the mitigation was actually vague, but because the auditor never saw the rest of it.
2. The auditor classifies any mitigation line that mentions the word "plan" as a reference to a downstream plan (i.e., "this will be handled by another plan"), even when the line is describing a procedure within the same plan (e.g., "run at the close of any plan that touches X").

Both defects mean the Deferred Verification Audit's findings can be wrong in a way that looks like the author's mitigation was weak, when the actual cause is the tool's parsing. The retrospective worked around this by rewriting both mitigations as single lines before the audit would accept them — a workaround, not a fix.

**How to apply:** if `auditPlanAtClose` (or the retrospective's Deferred Verification Audit step) flags a mitigation as vague or as a downstream-plan deferral, check the raw `mitigation:` text for (a) line wraps and (b) the word "plan" used in a non-deferral sense before trusting the finding. The actual fix belongs in `audit.ts`: read the full wrapped field, and distinguish "a plan will do X" (downstream deferral) from "do X at [some event involving] a plan" (an in-plan procedure) — not yet done as of context-tiers' landing (5ab6c408, 2026-10-02).

See `.indusk/planning/archive/context-tiers/retrospective.md` ("Deferred Verification Audit") and `apps/indusk-mcp/src/lib/trajectory/audit.ts`.
