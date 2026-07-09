---
name: planner
description: Create and advance plans. Every plan follows the same document lifecycle — research, brief, ADR, impl, retrospective. Knows how to write each one, what order they go in, and how to pick up where things left off.
argument-hint: "[workflow] [plan name] — workflow: feature (default), bugfix, refactor, spike"
---

You know how to plan work in this project.

## How Plans Work Here

Every plan lives in `.indusk/planning/{kebab-case-name}/` and follows the same document lifecycle:

```
research.md → brief.md → test-plan.md → adr.md → impl.md → retrospective.md
```

Each document builds on the ones before it. Not every plan needs all six — use the guide below to decide what's needed:

| Situation | Documents |
|---|---|
| Quick config change or bug fix | brief + impl |
| Architecture or technology decision | research + brief + test-plan + adr + impl |
| Exploratory spike (no commitment) | research only |
| Large feature or system change | all six |

The order is always preserved — never write an ADR before the brief, or an impl before the ADR (when both exist).

General-purpose research (insights useful across plans) also lives in `.indusk/research/`.

## Workflow Types

The first argument to `/planner` can optionally be a workflow type that controls which documents are created:

| Command | Workflow | Documents |
|---------|----------|-----------|
| `/planner bugfix auth-expiry` | bugfix | brief + test-plan + impl |
| `/planner refactor extract-auth` | refactor | brief + test-plan + impl (with boundary map) |
| `/planner spike redis-options` | spike | research only |
| `/planner feature payment-flow` | feature | full lifecycle (research + brief + test-plan + adr + impl + retrospective) |
| `/planner payment-flow` | feature | same — no type defaults to feature |

**Test plan is required for any workflow that ships an impl** (bugfix, refactor, feature). For a bugfix, the first behavioral assertion IS the failing test that proves the bug — you can't write a fix until you've named what should be true once it works. Spike is the only workflow that skips the test plan, because it skips the impl.

Parse the input: if the first word is `bugfix`, `refactor`, `spike`, or `feature`, use that workflow. Otherwise, default to `feature`. The remaining words become the plan name (kebab-cased).

Workflow templates are in `templates/workflows/` in the package. They describe which documents to create and provide streamlined templates for each workflow type.

## What to Do When Asked to Plan

1. **Determine the workflow type** from the input (see above). This controls which documents you create.

2. **Figure out where things stand.** If a plan folder already exists, read what's there. Check frontmatter statuses. The next document to write is the first one that's missing or incomplete.

3. **If starting fresh**, do a quick scan of the project (read CLAUDE.md, check the code graph) to understand the context. Then **ask the user discovery questions before doing any research or writing any documents.** The goal is to understand what they're trying to achieve, not just what they named the plan. Good discovery questions:
   - "What problem are you trying to solve?" or "What should this feature do for your users?"
   - "Is there anything specific you've already thought through or have strong opinions about?"
   - "Are there any constraints I should know about — timeline, technology preferences, things to avoid?"

   For non-developers especially, this conversation is critical. They may not know the right technical terms, but they know what they want. Draw that out before proceeding.

   Once you understand the intent, create the plan folder and start with the first document for the workflow type:
   - **feature**: start with research
   - **bugfix**: start with brief (streamlined template)
   - **refactor**: start with brief (includes boundary map)
   - **spike**: start with research (and stop there)

   **Check for existing research first.** Before writing new research, scan `.indusk/research/` for relevant standalone research docs. If one exists (e.g., `.indusk/research/auth-options.md`), ask the user: "I found existing research at `.indusk/research/auth-options.md`. Want to use this as the starting point?" If yes:
   - Copy it to `.indusk/planning/{plan-name}/research.md`
   - Set the frontmatter status to `complete`
   - Move straight to the brief

   The `.indusk/research/` directory is for standalone exploration that isn't tied to a plan yet. When it becomes a plan, it moves into the planning folder. The original in `.indusk/research/` can be deleted or kept as a reference — user's choice.

   For feature/spike workflows that need new research: Explore the problem space — read code, search the web, check Context7 for library docs. **Query the code graph before scoping** (see toolbelt "Before Modifying Code") — include structural findings in research.md with concrete numbers.
   Document what you find. The research doc records findings and analysis, but saves the recommendation for the brief.

4. **If research is done**, write the brief. This is where a direction emerges from the research. The brief proposes what we're building and why, informed by what the research uncovered. **Consider creating a visual sketch** of the proposed architecture with Excalidraw (if the extension is enabled) — a hand-drawn diagram makes the proposal concrete and easier to discuss. **Present the brief and have a conversation about it.** Don't just ask "does this look good?" — walk the user through it: "Here's what I'm proposing we build. Does this match what you had in mind? Is there anything missing, or anything here you don't want?" Iterate until the user is genuinely happy with the direction, then mark it as `accepted`.

   **When the brief moves from `draft` to `accepted`**, write a highlight so the eval agent can turn it into a structured Graphiti episode:
   ```
   mcp__indusk__highlight({
     tag: "brief-accepted",
     note: "{plan-name}: {one-line summary of Proposed Direction}",
     level: "critical"
   })
   ```
   The working agent does not write Graphiti episodes directly. The eval agent reads unprocessed highlights (via `highlights_unprocessed`), extracts the full Problem + Proposed Direction + Scope context from the transcript, writes a structured episode into the project group, and marks the highlight processed. Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort and must not fail brief acceptance. See [`apps/indusk-docs/src/reference/tools/highlights.md`](../../indusk-docs/src/reference/tools/highlights.md) for the full flow.

5. **If brief is accepted** and the workflow includes a test plan (bugfix, refactor, or feature — anything that ships an impl), write the test plan. The test plan is the bridge between the brief (what we want and why) and the ADR (architectural decision). It lists the **behavioral assertions** that must be true for the feature to be working, and for each assertion names **how it will be tested** — not the test code itself, but the test mechanism (vitest unit, vitest integration, end-to-end script, manual user test, manual smoke against running stack, etc.).

   The discipline this produces: when you walk into the ADR with a test plan in hand, the architectural decision is constrained by "what makes all these assertions true?" rather than invented from intuition. The ADR's "We decided for" / "And against" clauses gain teeth because alternatives can be rejected against specific assertions. The impl's Test Trajectory rows derive directly from the test plan's assertions — one trajectory row per assertion, with the `Writable at` / `Passes at` columns added during impl authoring.

   **CRITICAL: assertions must be BEHAVIORAL, not functional.** This is the single most important authoring discipline for the test plan. A behavioral assertion describes *what an outside observer sees the system do* — a user action, a visible outcome, an externally-observable state change. A functional assertion describes *how the system does it internally* — function calls, return types, internal state, method signatures. Functional assertions belong in unit tests inside the impl phase, not in the test plan.

   The phrasing test: read the assertion aloud to a non-engineer stakeholder. If they understand it without you having to explain a function name or type, it's behavioral. If you have to say "this is the function that…", it's functional — rewrite at the user-facing level.

   **Behavioral (good)** — describes what the user / outside observer experiences:
   - "User can sign in with Google."
   - "Sign-in with an invalid password shows the error 'Invalid credentials'."
   - "Forgotten-password email arrives in the user's inbox within 60 seconds."
   - "Settled match results appear in the user's history within 5 seconds of on-chain confirmation."
   - "Migration from rooms → tables preserves every existing row's primary key."
   - "Withdrawing $50 of chips returns $50 to the wallet within 5 seconds."

   **Functional (bad — rewrite)** — describes implementation details:
   - ❌ "googleAuth() returns a JWT" → behavioral: "User can sign in with Google"
   - ❌ "POST /api/login validates the request body schema" → behavioral: "Sign-in with malformed payload returns 400"
   - ❌ "jwt.sign() is called with the correct payload" → behavioral: "Authenticated requests survive a server restart"
   - ❌ "tablesRepository.create() inserts a row" → behavioral: "After creating a table, it appears in the table list"
   - ❌ "The reconstructFromDb() method reads the new column" → behavioral: "Restarting the server preserves in-progress hands"

   The mechanism column is the right place for "vitest unit" or "manual smoke" or "end-to-end script" — the *how to test*. The assertion column stays at the *what should be true* level. If naming a function or type creeps into the assertion, you've leaked the implementation across the boundary the test plan is meant to enforce.

   **Present the test plan for review.** Walk the user through the assertions: "Here's everything I think must be true for this to work, and how I'd test each one. Anything missing? Anything we'd test differently?" The user signs off before you proceed to the ADR. If they push back on assertions, that's the plan working — better to discover scope gaps here than at impl time. If you catch yourself writing functional-sounding assertions, stop and re-phrase before presenting.

   **When the test plan moves from `draft` to `accepted`**, write a highlight:
   ```
   mcp__indusk__highlight({
     tag: "test-plan-accepted",
     note: "{plan-name}: {N} assertions covering {one-line summary of feature scope}",
     level: "important"
   })
   ```
   Skip silently on highlight unavailability.

6. **If test plan is accepted** and the workflow includes an ADR (feature only), write the ADR. The ADR formalizes the decisions that were discussed during research and led to the brief. It records what was chosen, what was rejected, and why. **After the ADR is accepted**, add a one-liner to CLAUDE.md's Key Decisions section per the context skill: `- {decision summary} — see .indusk/planning/{plan}/adr.md`

   **When the ADR moves from `proposed` to `accepted`**, write a highlight so the eval agent can turn it into a structured Y-statement episode:
   ```
   mcp__indusk__highlight({
     tag: "adr-accepted",
     note: "{plan-name}: {chosen option} — rejected {primary alternative}",
     level: "critical"
   })
   ```
   The eval agent reads the highlight, pulls the full Y-statement from the ADR file, writes a structured episode into the project group, and marks it processed. Graphiti's entity extraction will pick up the chosen option, rejected alternatives, constraint, and rationale, and will detect contradictions if a later ADR overrides this one. The working agent does not write the episode directly. Skip silently on highlight unavailability — degrade gracefully.

7. **If ADR is accepted** (or brief is accepted for bugfix/refactor), write the impl. Break into phased checklists with concrete tasks. For refactor workflows, include a `## Boundary Map` section. For multi-phase impls of any type, consider adding a boundary map.

   **Derive the Test Trajectory from the test plan.** Every new impl opens with a `## Test Trajectory` table (after `## Boundary Map`, before `## Checklist`) that enumerates the tests the plan commits to. Columns: `ID | Asserts | Writable at | Passes at | State` (plus optional `Kind`, `Scope`). Test IDs are conventionally `T`-prefixed (`T1`, `T2`, …); `A`-prefixed IDs (`A1`, …) are also accepted — handy when the trajectory mirrors an acceptance-style test plan. For feature plans, walk the test plan's assertion list — each assertion becomes a trajectory row, with the assertion text becoming the `Asserts` column and the test plan's mechanism informing the optional `Kind`/`Scope` columns. Then walk each planned phase and assign `Writable at` / `Passes at`. Every phase's Verification block references test IDs from the trajectory rather than restating the checks. For bugfix/refactor workflows without a test plan, walk the ADR's Decision section (or the brief's Success Criteria) and ask "what test would prove this works?" for each item.

   **Writable at is the earliest possible phase, not the fix phase.** The rule: *if it is possible to write a test, write it — then let it pass when it will.* The validator only enforces `Writable at ≤ Passes at` (a floor); the real discipline is `Writable at = earliest feasible phase`. A test authored in the same phase as its fix is a rubber stamp — nothing proves intermediate phases didn't break it or fix it by accident. A test that goes red early and stays red through intermediate phases until its fix lands is a live tripwire: any intermediate phase that turns it green prematurely signals unexpected coupling; any intermediate phase that breaks an unrelated passing test signals regression.

   Honest shapes:
   - **Regression tests for reported bugs**: `Writable at: Phase 0` (the stack runs, the bug is reproducible today, no plan code needed to author). Passes at = the phase that lands the fix.
   - **End-to-end scenarios via HTTP/WS**: `Writable at: Phase 0` if the test can be a script hitting current endpoints (404 today is real-red). Passes at = the phase that closes the last gap. Only move later if authoring requires a not-yet-existing TypeScript symbol or constructor signature.
   - **Reconstruction / persistence tests**: `Writable at: Phase 0` if the test is a "restart-and-check" script (today fails because state doesn't persist, which is real-red). Move later only if the assertion references a not-yet-existing symbol.
   - **Unit tests for new code**: `Writable at = Passes at` is legitimate when the test's subject is a TypeScript symbol (schema file, new function, new enum value) introduced in that phase — the test file would not compile today.
   - **Grep-the-thing-is-gone tests**: `Writable at: Phase 0` (the old identifier exists today; the grep finds it, which is the red state). Passes at = the phase that removes the identifier.

   Challenge each row before you write it down: *"could this test be authored earlier than the phase that makes it pass?"* If yes, `Writable at` must point to that earlier phase. The Writable-phase's Verification block gains a `(write red)` item that commits the test against the current implementation and asserts the expected failure symptom; the Passes-phase's Verification block keeps its `(goes green)` item. Both reference the same test ID — the validator accepts multiple phase references to one trajectory row.

   **Phase 0 is the default; rationale is required only for Phase 1+ rows.** Every new impl sets `rationale: required` in its frontmatter. The `### Trajectory Rationale` subsection (placed after `### Deferred Verification`) is required ONLY when at least one trajectory row has `Writable at` later than Phase 0. Phase 0 means "writable today against the current stack, before any plan code lands" — it's the default and needs no justification. We only require rationale when a test will be authored AFTER some plan implementation has happened (Writable at: Phase 1+). This keeps the subsection from filling with "trivially writable today" boilerplate when most rows are correctly Phase 0.

   The `validate-impl-structure.js` hook enforces completeness: every Phase 1+ T-ID must appear as a `- **TN** \`Writable at: Phase N\` — {reason}` entry, the subsection itself must exist when any Phase 1+ row exists, and stale entries (entries for IDs not in the trajectory table) are flagged.

   Entry shape: `- **TN** \`Writable at: Phase N\` — {one-sentence reason}`. Examples:
   - `- **T22** \`Writable at: Phase 0\` — Bug is reproducible today against the running stack; test is authorable against current behavior and fails red.` *(no rationale entry needed; included here only as a reminder of the Phase 0 default)*
   - `- **T14** \`Writable at: Phase 5\` — Subject is the zod schema file authored in Phase 5; no import target exists before then.` *(needs rationale)*
   - `- **T20** \`Writable at: Phase 6\` — Test constructs PokerV2Room with a settings argument; the constructor signature gains the settings parameter in Phase 6, so TypeScript rejects the test source today.` *(needs rationale)*

   **The rationale-quality test:** *Does this rationale describe a compile error against today's symbols, or does it describe an uninteresting failure mode?* If the latter, the row is a rubber-stamp — move it to Phase 1.

   - **Legitimate `Writable > Phase 1` (compile error against today's symbols):**
     - Test imports a not-yet-exported TypeScript symbol — `import { pokerTableSettingsSchema } from "@numero/types"` when the export doesn't exist. The import line is a compile error; the test file cannot be authored.
     - Test constructs an object using a constructor signature that doesn't exist — `new PokerV2Room({ settings: {...} })` when the constructor doesn't take `settings`. TypeScript rejects.
     - Test asserts against an enum value that doesn't exist — `expect(result.phase).toBe(GamePhase.CollectingBlinds)` when `CollectingBlinds` isn't in the enum.
   - **Rubber-stamp `Writable > Phase 1` (red for an uninteresting reason — move to Phase 1):**
     - "Assertion checks for error code `X` which is introduced in Phase N." → String comparison. Authorable today; fails because today's response is silent-swallow or a different error code. Stays red until the convention lands.
     - "Endpoint doesn't exist yet." → HTTP request returns 404. Authorable today; 404-red is real-red.
     - "Column doesn't exist yet." → SQL query errors. Authorable today; query-error-red is real-red.
     - "Reconstruction code doesn't read from this column yet." → Restart-and-check script. Authorable today; whatever signal emerges is real.
     - "Migration script doesn't exist yet." → Migration runner returns "migration NNNN not found." Authorable today.

   The line is *can the test source code be authored today*, not *would it fail for a satisfying reason*. Red-for-uninteresting-reason is the whole point of `Writable at = Phase 1`: the test stays red through every intermediate phase, and any phase that turns it green prematurely or breaks an unrelated test surfaces a regression you'd otherwise miss.

   Why it matters: read the rationales as a set after authoring. If multiple rows share the same weak excuse ("depends on the fix landing", "endpoint doesn't exist yet", "error code not defined yet"), the plan is over-sequenced and those tests should move earlier. The rationale subsection is the discipline tool — the validator enforces its presence; the human judgment is whether each rationale describes a real compile error or a rubber-stamped failure mode.

   **Trajectory sizing:** 3–5 tests for a bugfix or small feature, 10–25 for a multi-phase infrastructure plan. Prefer one high-level property test over five example tests where possible. If your trajectory has more rows than lines of new code, the plan is over-specified — consolidate. If it has fewer than one row per phase, you probably have untested phases — add rows or declare `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})` in the phase's Verification.

   **Declare untestable items explicitly.** If a plan includes something that genuinely cannot be tested (LLM quality, paid external integrations, UX judgment), add a `### Deferred Verification` subsection below the trajectory table. Every deferred row requires three fields: `reason:` (why not testable here), `would require:` (what would unlock a proper test), and `mitigation:` (compensating control — alert, scheduled review, downstream plan, canary). Missing any field is a write-time error. If you can't name a mitigation, that's a signal: either reshape the plan so the capability becomes testable, or scope it out.

   **Set `trajectory: required` in the impl frontmatter.** This opts the impl into trajectory validation by `validate-impl-structure.js`. Omitting it means the hook skips trajectory rules (grandfathering for legacy impls); every NEW impl should set it.

   See [`apps/indusk-docs/src/guide/test-trajectory.md`](../../indusk-docs/src/guide/test-trajectory.md) for the full user-facing guide (published in the `tests-first-planning` plan's Phase 5) and [`apps/indusk-docs/src/reference/trajectory/parser.md`](../../indusk-docs/src/reference/trajectory/parser.md) for the parser/validator API reference. The design rationale lives in `.indusk/planning/tests-first-planning/adr.md`.

   **Gate policy applies when writing impls.** Set `gate_policy` in the impl frontmatter (`strict`, `ask`, or `auto`). The `validate-impl-structure` hook enforces this at write time:
   - **`strict` / `ask`**: Every gate section (Verification, Context, Document) must have a real item — `(none needed)` and `skip-reason:` are blocked at write time. Opt-outs only happen during `/work` execution.
   - **`auto`**: Gate sections can be pre-filled with `(none needed)` or `skip-reason:` at write time.

   Default is `ask`. See the work skill "Gate Override Policy" for full details on what each mode enforces at execution time. Trajectory enforcement (the four trajectory rules) applies regardless of `gate_policy` — the rules are structural, not policy-dependent.

   **OTel gate is conditional on `otel.role`.** Read `.indusk/config.json` for the project's `otel.role` field (or use the `shouldEmitOtelGate(projectRoot)` helper from `apps/indusk-mcp/src/lib/config.ts`). The OTel gate fires for projects whose `otel.role` is unset or `"service"` — these are user-facing apps that produce telemetry you want to collect. **Do NOT write `#### Phase N OTel` sections** for projects whose `otel.role` is `"library"`, `"tool"`, or `"none"` — these are libraries, CLIs, or scripts that should never emit telemetry and writing OTel gates for them is friction without value. The `validate-impl-structure` and `check-gates` hooks apply the same rule. The other gates (verify, context, document) always apply regardless of `otel.role`.

8. **If impl is completed** (all items checked off by `/work`), invoke the retrospective skill (`/retrospective {plan-name}`). This handles the structured audit (docs, tests, quality, context), knowledge handoff to the docs site, and archival. Do not write a freeform retrospective — use the skill. (Bugfix and refactor workflows may skip retrospective for small changes — user's call.)

9. **Always present each document for review** before moving to the next stage. The user signs off on each step.

## Cross-Referencing Between Plans

Plans frequently depend on or relate to each other. When work overlaps:
- Reference related plans by path: "See `.indusk/planning/security-hardening/` Phase 8"
- Use the `## Depends On` / `## Blocks` sections in the brief to make ordering explicit
- If a change in one plan affects another, update both — don't let them drift

## Document Templates

### research.md

Research is a record of exploration — what was asked, what was found, and how the findings compare. It includes factual analysis ("X doesn't support Y because of Z") but not recommendations ("we should use X"). Save recommendations for the brief.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: in-progress | complete
---

# {Title} — Research

## Question
{What are we trying to understand?}

## Findings

### {Topic 1}
{What we found. Facts, comparisons, analysis. Include code snippets when the syntax matters.}

## Open Questions
- {What remains unanswered}

## Sources
- {Links, references}
```

### brief.md
```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft | accepted
---

# {Title} — Brief

## Problem
{What problem are we solving? Why does it matter? 2-3 sentences.}

## Proposed Direction
{High-level approach, not implementation details.}

## Context
{Background. Reference research.md for deeper exploration.}

## Scope
### In Scope
- {Item}
### Out of Scope
- {Item}

## Success Criteria
- {How we know this worked}

## Depends On
- {Plans that must be completed before this one — e.g., `.indusk/planning/per-game-escrow/`}

## Blocks
- {Plans that are waiting on this one — e.g., `.indusk/planning/electric-ledger-sync/`}
```

### test-plan.md

The test plan is the bridge between the brief and the ADR. It enumerates the **behavioral assertions** that must be true for the feature to be working, plus the **mechanism** by which each assertion will be tested. It does NOT contain test code — only the contract the implementation must satisfy and the kind of test that will verify it.

**Behavioral, not functional.** Every assertion must describe what an outside observer (typically a user) experiences — not what an internal function does. "User can sign in with Google" not "googleAuth() returns a JWT." See step 5 above for the full bad-vs-good list. If an assertion mentions a function name, type name, internal endpoint name, repository method, or other implementation detail, rewrite it at the user-facing level before saving.

```markdown
---
title: "{Title} — Test Plan"
date: {YYYY-MM-DD}
status: draft | accepted
---

# {Title} — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names the mechanism by which it will be tested — not the test code, but the test approach (vitest unit / vitest integration / end-to-end script / manual user test / manual smoke / etc.). When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows this document is constrained by "what makes all these assertions true?" rather than invented from intuition.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** Describe what the user sees, what the API returns to a caller, what an external observer measures — never internal function calls, return types, or method signatures. If a non-engineer stakeholder couldn't read an assertion and understand it, rewrite it.

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | {Behavioral fact — e.g., "User can sign in with Google."} | {vitest unit / vitest integration / e2e script / manual user test / manual smoke} |
| A2 | {Behavioral fact — e.g., "Sign-in with invalid password shows the error 'Invalid credentials'."} | vitest integration |
| A3 | {Behavioral fact — e.g., "Forgotten-password email arrives in inbox within 60 seconds."} | manual smoke (account on staging) |

## Untestable Assertions

{Optional. Include only if the feature has behaviors that cannot be tested within this plan — LLM output quality, paid third-party integrations, UX judgment, behaviors only observable in production traffic. For each, name the reason and what compensating control covers it.}

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | {behavior} | {why no test} | {alert / scheduled review / canary / downstream plan} |

## Notes

- {Open questions about the test approach}
- {Known mechanism choices that may need revisiting}
```

### adr.md
```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: proposed | accepted | deprecated | superseded | abandoned
---

# {Title}

## Goal

**{One sentence. The headline outcome, in plain language. What will be true when this ADR's decisions ship that isn't true today.}**

{One short paragraph — 2-4 sentences — grounding the goal in concrete user-visible terms. Name at least one specific current failure this fixes, so a reader arriving cold can tell what problem the rest of the ADR is solving. The Y-statement below formalizes the decision; this section lets a reader skim the headline without hunting through seven clauses first.}

## Y-Statement

**In the context of:**
{the use case — one paragraph, plain text, not bold}

**Facing:**
{the constraint or problem the use case presents — one paragraph}

**We decided for:**
{the chosen option — one paragraph}

**And against:**
{the rejected alternatives — one paragraph}

**To achieve:**
{the desired outcome — one paragraph}

**Accepting:**
{the tradeoff — one paragraph}

**Because:**
{the rationale — one paragraph}

Format rules (the standard Y-statement format for every ADR in every project going forward):
- Use all seven canonical clauses: In the context of, Facing, We decided for, And against, To achieve, Accepting, Because. These are the standard Y-statement fields — do not collapse, rename, or omit them.
- Each clause is its own section. The clause label is bold and ends with a colon.
- The paragraph body begins on the next line immediately after the bold label — no blank line between the label and the paragraph.
- The paragraph body is plain text — not bold, no inline label.
- A blank line separates each clause (between the end of one paragraph and the next bold label).

## Context
{Situation and background. Reference research and brief.}

## Decision
{What was decided, specifically.}

## Alternatives Considered
### {Alternative 1}
{Why rejected.}

## Consequences
### Positive
- {Benefit}
### Negative
- {Tradeoff}
### Risks
- {Risk and mitigation}

## Documentation Plan
{Decide upfront what documentation this feature produces. This shapes the Document gates in the impl.}

### Pages
- {New page or existing page to update — e.g., "New: reference/tools/settlement-api.md", "Update: guide/getting-started.md"}

### Diagrams
- {What diagrams are needed — e.g., "Architecture diagram showing settlement flow", "Sequence diagram for agent registration"}
- {Where they go — e.g., "Mermaid in reference/tools/settlement-api.md", "Standalone in guide/architecture.md"}

### Changelog
- {What changelog entry — e.g., "Added settlement API with EIP-712 receipts"}

### ADR in Docs
- {Should this ADR be published to the docs site? If yes, which section — e.g., "decisions/settlement-architecture.md"}

## References
- {Links to research, brief, related plans, external resources}
```

### impl.md

Include code snippets in checklist items when the syntax matters — function signatures, schema definitions, hash formats, config structures. The impl should be precise enough that someone can execute it without guessing at names or shapes.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft | approved | in-progress | completed | abandoned
trajectory: required
rationale: required
gate_policy: ask
---

# {Title}

## Goal
{What this achieves and why.}

## Scope
### In Scope
- {Item}
### Out of Scope
- {Item}

## Boundary Map

For multi-phase impls, include a boundary map showing what each phase produces and consumes. Required for refactor workflows, recommended for features with 2+ phases.

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | {exports, types, modules created} | {inputs, dependencies used} |
| Phase 2 | {what this phase adds} | {what it needs from Phase 1} |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | {one-line assertion — what the test claims is true} | Phase 1 | Phase 1 | planned |
| T2 | {another assertion} | Phase 1 | Phase 2 | planned |

{Optional subsection — include ONLY if this plan has items that are genuinely untestable within its scope. Each row requires all three fields: reason, would require, mitigation.}

### Deferred Verification

- **{short name of the untestable item}**
  - reason: {why this cannot be tested in this plan}
  - would require: {what would unlock a proper test — a new environment, a future plan, production data}
  - mitigation: {compensating control — telemetry alert, scheduled review, downstream plan, canary procedure, feedback signal}

### Trajectory Rationale

**Starting assumption: every test is writable at Phase 0 (pre-plan) against the current stack — Phase 0 rows need no rationale.** This subsection is required ONLY when one or more rows have `Writable at` later than Phase 0. List one entry per Phase 1+ row, naming what prevents authoring the test before plan code lands. Read the entries together — if multiple rows share the same weak excuse, the plan is over-sequenced.

- **T3** `Writable at: Phase 2` — {one-sentence reason — typically because the subject under test is a TypeScript symbol authored in Phase 2 and the test file would not compile against today's stack}
- **T14** `Writable at: Phase 5` — {reason — e.g., "subject is the zod schema introduced in Phase 5; the test's import line is a compile error today"}

The `validate-impl-structure.js` hook enforces that every Phase 1+ T-ID from the trajectory table appears as an entry here. Phase 0 rows are exempt. Stale entries (rationale entries for IDs not in the trajectory) are flagged.

## Checklist
### Phase 1: {Name}
- [ ] {Task — include code snippets when syntax matters}
  ```typescript
  // Example: function signature that must match this shape
  function withdrawFor(wallet: address, player: address, amount: uint256, historyHash: bytes32)
  ```

{OPTIONAL: #### Phase 1 OTel — include ONLY if the project's `otel.role` in `.indusk/config.json` is unset or `"service"`. Skip the entire OTel block for projects with `otel.role: "library" | "tool" | "none"`. Use `shouldEmitOtelGate(projectRoot)` from `apps/indusk-mcp/src/lib/config.ts` to decide.}

#### Phase 1 OTel
- [ ] {Instrumentation check — are new code paths observable? See the OTel skill for patterns. Example items: "New endpoints have manual spans with `otel.category` and domain attributes", "Errors recorded with `recordException` + `setStatus(ERROR)` + trace-correlated log". Ask: "did this phase add endpoints, business logic, state transitions, or error paths?" If not, this section can be opted out per gate policy.}

#### Phase 1 Verification
- [ ] T1 passes (`{runnable command, e.g. pnpm test}`)
- [ ] T2 flips to `written` state (skipped until Phase 2)

{If a phase has no tests flipping at it, declare it explicitly — NOT silently:}
{- [ ] (no tests flip at this phase — reason: {schema-only | delete | refactor | infra})}

#### Phase 1 Context
- [ ] {Concrete CLAUDE.md edit this phase produces — e.g., "Add to Architecture: ...", "Add to Conventions: ...", "Update Current State: ...". Ask: "what does this phase change about how the project works?" If nothing, omit this section.}

#### Phase 1 Document
- [ ] {Docs page to write or update — e.g., "Write reference page at apps/indusk-docs/src/reference/tools/tool-name.md", "Update architecture diagram in docs". Ask: "what does a user or developer need to know about what this phase built?" If nothing user-facing, omit this section. See the document skill for guidance on what to document and how.}

## Files Affected
| File | Change |
|------|--------|
| `{path}` | {description} |

## Dependencies
- {What must exist before starting}

## Notes
{Open questions, deferred decisions.}
```

### retrospective.md

The retrospective covers the full story of getting to done — not just what was built, but what broke, what had to be fixed after the impl was "complete," and what it actually took to reach a working state. The impl checklist tracks planned work; the retrospective captures the unplanned work, the debugging, the surprises, and the real cost of getting there.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
---

# {Title} — Retrospective

## What We Set Out to Do
{Recap of problem and approach, referencing brief and ADR.}

## What Actually Happened
{What was built. How did it diverge from the plan?}

## Getting to Done
{The full story after the impl was "complete." What broke? What needed fixing? What unplanned work was required to actually reach a working state? This is often where the real learning happens.}

## What We Learned
- {Lesson — technical, process, or domain insight}

## What We'd Do Differently
- {Hindsight — decisions that could have been better, steps to skip or add}

## Insights Worth Carrying Forward
{Takeaways for future plans. Save to .indusk/research/ if broadly useful.}

## Quality Ratchet
{Could any mistakes in this plan have been caught automatically by a Biome rule? If yes, add the rule to biome.json and document it in biome-rationale.md. The quality ratchet only gets tighter.}

## Metrics
- Sessions spent: {N}
- Files touched: {N}
- Lines added/removed: {+N / -N}
- {Other measurable outcomes — performance before/after, test count, etc.}
```

## Folder Conventions

```
.indusk/planning/
├── {plan-name}/
│   ├── research.md
│   ├── brief.md
│   ├── test-plan.md
│   ├── adr.md
│   ├── impl.md
│   └── retrospective.md
└── archive/
    └── {completed-plan}/

.indusk/research/            # Standalone insights useful across plans
```

- Kebab-case folder names
- Archive completed/abandoned plans to `.indusk/planning/archive/`
- When revising, archive the old version first (`.indusk/planning/archive/{name}_v1/`)

## Important

- Read relevant source code before writing. Documents should reference actual files, functions, and current behavior.
- **Use the code graph for scoping.** Before writing a brief or impl, query `analyze_code_relationships` to understand what depends on what. "How many files import X?" and "What calls this function?" prevent underscoping.
- Keep Y-statements concise but complete. Every field filled in.
- Impl checklists: granular enough to track, not so granular they're busywork.
- When research produces broadly useful insights, also save to `.indusk/research/`.
- Cross-reference related plans by path whenever work overlaps between plans.
- The user's input is: $ARGUMENTS
