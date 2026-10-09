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

**Every plan declares its type.** Write `workflow: <type>` in the brief's frontmatter when you create it — `workflow: feature` when no type was given — and, for a spike, in the research document's, since a spike has no brief. The admin reads it to tell a document the plan was never going to have from one it should have had: with no declared type, an absent document reads *unknown*, never *skipped*. What each type requires is defined once, in the package's `workflow-types` module; the table above and the workflow templates are pinned equal to it by test, so change all three together.

Workflow templates are in `templates/workflows/` in the package. They describe which documents to create and provide streamlined templates for each workflow type.

## What to Do When Asked to Plan

0. **Read `.indusk/planning/master.md` first**, before writing any plan document. The planning rules live in `.indusk/planning/CLAUDE.md`, and Claude Code loads a nested context file when a file beneath it is *read* — a Write to a directory nothing has been read from loads nothing (measured, context-tiers A17). Reading the master puts the planning rules in context before the plan's first file is authored, and tells you where the plan sits in the sequence. A project with no `master.md` yet: read `.indusk/planning/CLAUDE.md` itself.

1. **Determine the workflow type** from the input (see above). This controls which documents you create.

2. **Figure out where things stand.** If a plan folder already exists, read what's there. Check frontmatter statuses. The next document to write is the first one that's missing or incomplete.

3. **If starting fresh, have the conversation first.** The conversation is the plan's input: the person says what they want, and the plan's promises come out of it. Do a quick scan of the project (read CLAUDE.md, skim the relevant source) so your questions are informed, start the plan on its own branch — `indusk plans start <type> <name>`, which creates `plan/<name>`, its worktree and its first document there, and writes nothing on `main` — and work in that worktree from then on; then talk before you research or write anything. A plan the admin started already has its worktree: you are in it. Writing a plan on `main` is not refused, but each such commit is recorded as a violation of `a-plan-is-written-on-its-own-branch`.

   - **What they want.** Ask what should be true when this is done, in their words: "What should this do for the people who use it?", "What is wrong today?", "Is there anything you have already decided, or want to avoid?" Ask why as well: what they expect to follow from it. Settle what will be true, not how to build it: an approach offered before the promises exist anchors the conversation on the code, and how is the ADR's question. For a non-developer this is the whole of their input. They may not have the technical terms; they know what they want. Draw that out.
   - **What already holds.** Call `list_promises` and read every promise in force. Go through the ones this work comes near and settle with the person which of three things is true of each: it is still true as written and this plan must not break it; it is the same commitment and its sentence should now say more, or say it better (a **change**); or its name no longer describes it (a **replacement**). Prefer a change to a replacement: an improved promise keeps its name, its history and its incidents.
   - **Say it back.** Put what you heard as promises, one plain sentence each about what will be true and never about how, and as expectations, each with how you would know and when to look. Say them back and take corrections until the person agrees. Nothing is saved yet.

   Everything else the conversation turns up (what exists today, what has been tried, what was decided on the way and why) is research, not brief.

   Then start with the first document for the workflow type:
   - **feature**: start with research
   - **bugfix**: start with brief
   - **refactor**: start with brief (the impl carries the boundary map)
   - **spike**: start with research (and stop there)

   A bugfix or a refactor has no required research document, and may carry one anyway: it is where the why goes when there is more of it than a brief holds.

   **Check for existing research first.** Before writing new research, scan `.indusk/research/` for relevant standalone research docs. If one exists (e.g., `.indusk/research/auth-options.md`), ask the user: "I found existing research at `.indusk/research/auth-options.md`. Want to use this as the starting point?" If yes:
   - Copy it to `.indusk/planning/{plan-name}/research.md`
   - Set the frontmatter status to `complete`
   - Move straight to the brief

   The `.indusk/research/` directory is for standalone exploration that isn't tied to a plan yet. When it becomes a plan, it moves into the planning folder. The original in `.indusk/research/` can be deleted or kept as a reference — user's choice.

   For feature/spike workflows that need new research: Explore the problem space — read code, search the web for library docs. **Grep for the affected symbols' consumers before scoping** — include structural findings in research.md with concrete numbers.
   Document what you find. Research holds the background, the findings and the decisions made on the way. It does not hold promises, and the brief does not repeat it.

4. **If research is done** (or the workflow starts at the brief), write the brief. A brief is what the conversation produced and holds two things: the **expectations** (why we are doing this, each with a measure and a time to look) and the **promises** (what will be true: the ones this plan makes, and the existing ones it must not break, changes or replaces). It holds nothing else. The problem, the context and the findings are research; the approach is the ADR's; what "done" means is said once, as promises, and not again as success criteria. The template is below; the shape is read by a program, so keep it exactly. — see `/guide/briefs`

   - **Expectations decide what gets measured.** An expectation says what we expect to follow and how we would know, so writing one is also deciding what telemetry the work needs. Most can only be measured in production; say so in the measure. An expectation that does not happen is information, not a defect, and blocks nothing. A plan with none writes `None — {reason}`.
   - **Each promise is one sentence, observable, with a name and a kind.** A kebab-case name; the kind is `behaviour` (breaks on inputs nobody chose; watched in the running system), `state` (breaks on a later change; a test) or `structure` (breaks when something is removed or duplicated; a build-time check). Assign the kind from the sentence; the person can correct it. If a test with inputs you choose can prove it, it is `state`, even when it describes something a user does: `behaviour` is for what only the running system shows, and it asks for marks in that system.
   - **Write it as `status: draft` and present it.** The draft is the conversation read back on paper. Walk the person through it: "Here is what I understood we are promising, and what we expect to follow. Is anything missing? Is there anything here you do not want to promise?" Iterate until they agree. A draft is not yet held to the registry, so edit it freely.

   **When the person accepts the brief, save its promises with the tools. Never type a file under `.indusk/promises/`:**

   - `declare_promise` for each promise under **This plan makes**;
   - `replace_promise` for each entry under **Replaces** (it declares the new promise recording which it replaces; the old one stays in force until this plan closes). A promise that is some entry's replacement is saved this way only, not also with `declare_promise`; if it was, `replace_promise` records the link on it;
   - nothing yet for **Changes**: `change_promise` rewrites a promise's sentence, and the registry must not say what the code does not yet do, so it is run in the build phase that makes the new sentence true. Give the impl a checklist item for it.

   Then run `indusk promises contract {plan-name}`. It refuses, naming the promise or the expectation, until the brief and the registry agree. When it passes, set `status: accepted`. From then on `indusk promises check` holds the plan to it, and so does the project's test run wherever that runs the check.

   **If the person later drops or renames a promise this plan declared**, take it back with `withdraw_promise` and edit the brief to match. A rename is `withdraw_promise`, then `declare_promise` with the new name. A dropped promise that was seriously considered goes under **Not promised**, with where it went. Never delete a file under `.indusk/promises/` by hand. Only a promise that was never in force can be withdrawn: one that is already `enforced` leaves the registry when a later plan replaces it.

   **When the brief moves from `draft` to `accepted`**, write a highlight so the eval agent can record it:
   ```
   mcp__indusk__highlight({
     tag: "brief-accepted",
     note: "{plan-name}: promises {the names of the promises it makes}",
     level: "critical"
   })
   ```
   The working agent does not materialize highlights directly. The eval agent reads unprocessed highlights (via `highlights_unprocessed`), extracts context from the transcript, records what's durable (usually the plan docs already carry it), and marks the highlight processed. Skip silently if `mcp__indusk__highlight` is unavailable — highlights are best-effort and must not fail brief acceptance. See [`apps/docs/src/reference/tools/highlights.md`](../../docs/src/reference/tools/highlights.md) for the full flow.

5. **If brief is accepted** and the workflow includes a test plan (bugfix, refactor, or feature — anything that ships an impl), write the test plan. The test plan is the bridge between the brief (what we want and why) and the ADR (architectural decision). It lists the **behavioral assertions** that must be true for the feature to be working, and for each assertion names **its level** — which of the five levels of test proves it, and so when that test runs:

   | Level | The question it answers | When it runs |
   |---|---|---|
   | `unit` | Is this rule right? | in the phase that writes it; part of `pnpm test` |
   | `contract` | Do we still fit something we do not own (Jaeger's API, npm, a browser, the OS, Claude Code)? | the system tier: at landing and on release |
   | `live check` | Does the whole story work against the real system? | once, recorded in the plan with its result |
   | `smoke` | Is the deployed thing alive? | at deploy |
   | `promise` | Is it still true in production? | continuously, by the watcher |

   **Name the smallest level that can prove the assertion.** An assertion's *wording* is behavioural; its *level* is usually `unit`, because the behaviour is decided by a rule, and a rule is tested by feeding it inputs. Reach for `contract` only when the question is about the thing you do not own — a store's late-run rule is a `unit`, "Jaeger still answers our query the way we expect" is a `contract`. Code that decides takes its clock and its reads as inputs so its rules can be `unit` tests (`lesson: code-that-decides-takes-its-clock-and-its-reads`); a test that starts a server or waits on the wall clock belongs in the system tier, and the everyday suite refuses it (`lesson: everyday-tests-never-wait`). The five are defined once, in the package's `test-levels` module. (In 1.61 a test's level was called its *kind*. A promise already has a kind, and a row names both, so the test's word changed.)

   **Group the assertions by promise.** Each promise the brief makes gets a heading, with the assertions that prove it under it. An assertion that proves no promise goes under its own heading with the reason: a regression guard, a rename, a lesson. The grouping becomes each row's `For` cell in the impl. A promise with no assertion under it will have no row to prove it, and the plan will not be able to close.

   The discipline this produces: when you walk into the ADR with a test plan in hand, the architectural decision is constrained by "what makes all these assertions true?" rather than invented from intuition. The ADR's "We decided for" / "And against" clauses gain teeth because alternatives can be rejected against specific assertions. The impl's Test Trajectory rows derive directly from the test plan's assertions — one trajectory row per assertion, with the `Writable at` / `Passes at` columns added during impl authoring and the promise it sits under as its `For`.

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

   The Level column is the right place for the *how to test* — one of the five. The assertion column stays at the *what should be true* level. If naming a function or type creeps into the assertion, you've leaked the implementation across the boundary the test plan is meant to enforce.

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

6. **If test plan is accepted** and the workflow includes an ADR (feature only), write the ADR. The ADR formalizes the decisions that were discussed during research and led to the brief. It records what was chosen, what was rejected, and why. The root `CLAUDE.md`'s Key Decisions line for it (`- {decision summary} — see /decisions/{plan}`, per the claude-md skill) is **not written now**: `plans approve` refuses a branch that changed anything outside `.indusk/` before its build. Instead, give the impl's first build phase a Context item for the Key Decisions line, so it is written with the code.

   **When the ADR moves from `proposed` to `accepted`**, write a highlight so the eval agent can turn it into a structured Y-statement episode:
   ```
   mcp__indusk__highlight({
     tag: "adr-accepted",
     note: "{plan-name}: {chosen option} — rejected {primary alternative}",
     level: "critical"
   })
   ```
   The eval agent reads the highlight, pulls the full Y-statement from the ADR file, records what's durable (the ADR itself is the canonical record), and marks it processed. The working agent does not materialize the highlight directly. Skip silently on highlight unavailability — degrade gracefully.

7. **If ADR is accepted** (or brief is accepted for bugfix/refactor), write the impl. Break into phased checklists with concrete tasks. For refactor workflows, include a `## Boundary Map` section. For multi-phase impls of any type, consider adding a boundary map.

   **Name every phase's tier.** Every phase carries `**Tier**: <tier>` under its heading, written when you write the phase: the step's default spelled out (`indusk plans model` answers from it), or a different tier with its reason (`**Tier**: strong — edits the readiness gate every plan's close goes through`). A tier other than the default needs its reason, or the impl is refused. The config names the model, not the plan.

   **Open Phase 1 with a worktree kickoff item.** Worktree-per-plan is the default (see the `worktree-visibility` ADR): every impl's first phase begins with a checklist item that creates or confirms the plan's own worktree — e.g. `Create/confirm this plan's worktree (indusk worktree create <plan>, which records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs indusk worktree assign <plan> <path>) — worktree-per-plan default; skip only if worktree: none in frontmatter`. A plan opts out by setting `worktree: none` in the impl frontmatter (no workflow sets it by default — even hotfix gets a worktree). `/work`'s Worktree Kickoff step reads the frontmatter and nudges before code is written; the kickoff item makes the intent explicit in the checklist.

   **Derive the Test Trajectory from the test plan.** Every new impl opens with a `## Test Trajectory` table (after `## Boundary Map`, before `## Checklist`) that enumerates the tests the plan commits to. Columns: `ID | Asserts | Writable at | Passes at | State | Level | For | Test`. `Level` is one of the five, from the test plan; set `test_levels: required` in the frontmatter and the hook refuses a row with none or another word. `For` says what the row is for; set `test_purpose: required` and the hook refuses a row that does not say. `Test` names the row's test files. (An impl written with `Kind` and `test_kinds: required` still validates.) Test IDs are conventionally `T`-prefixed (`T1`, `T2`, …); `A`-prefixed IDs (`A1`, …) are also accepted — handy when the trajectory mirrors an acceptance-style test plan. For feature plans, walk the test plan's assertion list — each assertion becomes a trajectory row, with the assertion text becoming the `Asserts` column, the test plan's level its `Level`, and the promise it is grouped under its `For`. Then walk each planned phase and assign `Writable at` / `Passes at`. Every phase's Verification block references test IDs from the trajectory rather than restating the checks. A bugfix or a refactor has no ADR: its rows come from its test plan the same way.

   **Every row says what it is for.** A `For` cell holds `promise: <name>` (one or more, separated by commas), `lesson: <name>`, or any other text, which is the reason the row needs neither. A row that names a promise names its test files in `Test`, relative to the code root, by the time it is `passing`: closing the plan reads them, and when the promise breaks later its incident lists the rows that named it. The hook refuses an empty `For` cell, a promise or lesson that does not exist, and a row that names another plan's promise the brief does not list. If the brief lists a promise under **Changes**, give the phase that makes its new sentence true the item `indusk promises change <name> --plan <plan> --statement "…" --reason "…"`.

   **Writable at is the earliest possible phase, not the fix phase.** The rule: *if it is possible to write a test, write it — then let it pass when it will.* The validator only enforces `Writable at ≤ Passes at` (a floor); the real discipline is `Writable at = earliest feasible phase`. A test authored in the same phase as its fix is a rubber stamp — nothing proves intermediate phases didn't break it or fix it by accident. A test that goes red early and stays red through intermediate phases until its fix lands is a live tripwire: any intermediate phase that turns it green prematurely signals unexpected coupling; any intermediate phase that breaks an unrelated passing test signals regression.

   Honest shapes:
   - **Regression tests for reported bugs**: `Writable at: Phase 0` (the stack runs, the bug is reproducible today, no plan code needed to author). Passes at = the phase that lands the fix.
   - **End-to-end scenarios via HTTP/WS**: `Writable at: Phase 0` if the test can be a script hitting current endpoints (404 today is real-red). Passes at = the phase that closes the last gap. Only move later if authoring requires a not-yet-existing TypeScript symbol or constructor signature.
   - **Reconstruction / persistence tests**: `Writable at: Phase 0` if the test is a "restart-and-check" script (today fails because state doesn't persist, which is real-red). Move later only if the assertion references a not-yet-existing symbol.
   - **Unit tests for new code**: `Writable at = Passes at` is legitimate when the test's subject is a TypeScript symbol (schema file, new function, new enum value) introduced in that phase — the test file would not compile today.
   - **Grep-the-thing-is-gone tests**: `Writable at: Phase 0` (the old identifier exists today; the grep finds it, which is the red state). Passes at = the phase that removes the identifier.

   Challenge each row before you write it down: *"could this test be authored earlier than the phase that makes it pass?"* If yes, `Writable at` must point to that earlier phase. The Writable-phase's Verification block gains a `(write red)` item that commits the test against the current implementation and asserts the expected failure symptom; the Passes-phase's Verification block keeps its `(goes green)` item. Both reference the same test ID — the validator accepts multiple phase references to one trajectory row.

   **Test Phase 1 comes first, and it is the register.** Every new impl sets `test_phases: required` in its frontmatter and opens with `### Test Phase 1`, before any build phase. Build phases are spelled `### Build Phase N` (`### Phase N` still means the same thing, so no existing plan needs editing). The two sequences number independently and are ordered by their position in the document.

   Test Phase 1 does two jobs. It **authors every test that can honestly be authored**, and it **records every test that cannot**, with a reason. That second job is why the phase exists: "write the tests first" was previously expressed only as a column value, which meant the deviation had machinery behind it and the rule did not.

   Its register has two subsections, both read structurally rather than as prose:

   - `#### Deferred to Test Phase N` — justifies the *existence* of a later test phase. Any `### Test Phase N` where N > 1 requires a matching entry here, or the impl is refused, naming the phase.
   - `#### Deferred to Build Phase N` — justifies a single test authored later than Test Phase 1, usually because its subject is a symbol that build phase introduces.
   - `#### Regression Guards` — declares rows that pass the moment they are authored. A row whose `Writable at` and `Passes at` both name the same test phase has no red window; that is legitimate for a regression guard or an assertion about the runner, and it is also what a rubber stamp looks like. Nothing can separate them mechanically, so the author says which, with a `- **T1** — {why}` entry.

   **A deferral may carry the deferred test's body** as a fenced code block. This is the preferred shape, because it turns a promise into something a reader can check: does this compile at the phase it names, and does it assert what it claims? Code fences are inert to every parser, so the body can contain checkbox- and heading-shaped lines freely.

   **Deferring means deferring — do not reach for `.skip()`.** A test whose file cannot load has not been authored; it is an absent test wearing a failure's clothes, and `.skip()` does not rescue it, because module resolution happens before test collection. `.skip()` is right when the *symbol exists* and the behaviour does not. A commented body in the Test Phase 1 register is right when the symbol does not exist yet.

   **Phase 0 is the default; rationale is required only for Phase 1+ rows.** ***In a plan with a test phase, the register replaces this section entirely — do not author both.*** `### Trajectory Rationale` is the pre-test-phase spelling of the same idea, kept so that existing impls keep validating; when a test phase is present the validator skips the rule outright, because two homes for one fact is a failure this codebase has three lessons about. What follows describes the legacy shape.

   Every new impl sets `rationale: required` in its frontmatter. The `### Trajectory Rationale` subsection (placed after `### Deferred Verification`) is required ONLY when at least one trajectory row has `Writable at` later than Phase 0. Phase 0 means "writable today against the current stack, before any plan code lands" — it's the default and needs no justification. We only require rationale when a test will be authored AFTER some plan implementation has happened (Writable at: Phase 1+). This keeps the subsection from filling with "trivially writable today" boilerplate when most rows are correctly Phase 0.

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

8. **If impl is completed** (all items checked off by `/work`), the close-out rituals run before retrospective: `/falsify {plan-name}` then `/cleanup {plan-name}` — each authors a phase (`### Phase N: Falsification` / `### Phase N: Cleanup`) that `/work` executes — then `/audit {plan-name}`, which has a fresh reader on the `audit` step's tier write `audit.md` (advisory). `/retrospective` Step 0 hard-blocks without falsification and cleanup terminal-or-skipped and `audit.md` present or `audit: skipped` with `audit_reason`. Then invoke the retrospective skill (`/retrospective {plan-name}`). This handles the structured audit (docs, tests, quality, context), knowledge handoff to the docs site, confirming the plan's promises (`indusk promises confirm`, which a declared promise no passing row names refuses), and archival. Do not write a freeform retrospective — use the skill. (Bugfix and refactor workflows may skip retrospective for small changes — user's call. A plan that skips it still runs `indusk promises confirm {plan-name}` before it is archived; one archived without it is confirmed later with the same command, or its unkept promise withdrawn.)

9. **Always present each document for review** before moving to the next stage. The user signs off on each step.

10. **Approval brings the plan to `main`.** When the person approves the impl, run `indusk plans approve <name>` rather than setting the status by hand: it runs the brief check (and refuses with its message), sets the impl `approved`, and merges the plan's documents and declared promises into `main`, so every other plan sees the promises before any code. The build continues on the same branch. A plan's build reaches `main` only through `indusk plans land`, which refuses a plan that has not been accepted.

    **The planning session ends at the written plan.** It never edits the status by hand and never begins the build: `check-gates.js` refuses a plan leaving `draft` any other way than `plans approve`, and refuses a build item checked off on a plan that is not approved (`lesson: a-plan-builds-only-after-approval`). Building is `/work`'s, after approval.

## Cross-Referencing Between Plans

Plans frequently depend on or relate to each other. When work overlaps:
- Reference related plans by path: "See `.indusk/planning/security-hardening/` Phase 8"
- Use the `## Depends On` / `## Blocks` sections in the brief to make ordering explicit
- If a change in one plan affects another, update both — don't let them drift

## Document Templates

### research.md

Research is the record of what was found and decided on the way: the background (why this, what exists today), the findings, and the decisions made in conversation. It includes factual analysis ("X doesn't support Y because of Z"). It does not hold promises, which are the brief's, or the approach, which is the ADR's.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: in-progress | complete
---

# {Title} — Research

## Question
{What are we trying to understand?}

## Background
{Why this, why now. What exists today and what is wrong with it. The problem lives here; the brief does not repeat it.}

## Findings

### {Topic 1}
{What we found. Facts, comparisons, analysis. Include code snippets when the syntax matters.}

## Decisions
- {What was settled in conversation on the way, who settled it and why — e.g. "The column is `Level`, not `Kind` (Sandy, 2026-10-05): a promise already has a kind."}

## Open Questions
- {What remains unanswered}

## Sources
- {Links, references}
```

### brief.md

A brief holds what the conversation produced: expectations and promises. `indusk promises contract` reads this shape, so keep the headings, keep each label on its own line, and start each entry with the promise's name as written here. Prose between the parts is fine.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft | accepted
workflow: feature | bugfix | refactor | spike
---

# {Title} — Brief

## Expectations

1. **{What we expect to follow from this.}**
   - Measure: {how we would know: what is counted or read, and where}
   - Look: {when to check}

{When there are none, write instead: None — {the reason}}

## Promises

### This plan makes

1. **`{promise-name}`** ({behaviour | state | structure}). {The promise, in one plain sentence: what will be true.}

### Existing promises

**Must not break**

- **`{promise-name}`**. {Why this plan comes near it.}

**Changes**

- **`{promise-name}`**. {The promise as it will read.}

**Replaces**

- **`{old-name}`**, by **`{new-name}`**.

{Write `None.` under any of the three that has no entry.}

### Not promised

- {What was considered and deliberately not promised, and where it goes instead.}

## Depends On
- {Plans that must be completed before this one — e.g., `.indusk/planning/per-game-escrow/`}

## Blocks
- {Plans that are waiting on this one — e.g., `.indusk/planning/electric-ledger-sync/`}
```

### test-plan.md

The test plan is the bridge between the brief and the ADR. It enumerates the **behavioral assertions** that must be true for the feature to be working, plus the **level** of test that proves each — one of `unit`, `contract`, `live check`, `smoke`, `promise`, the smallest that can — grouped by the promise they prove. It does NOT contain test code — only the contract the implementation must satisfy and the level of test that will verify it.

**Behavioral, not functional.** Every assertion must describe what an outside observer (typically a user) experiences — not what an internal function does. "User can sign in with Google" not "googleAuth() returns a JWT." See step 5 above for the full bad-vs-good list. If an assertion mentions a function name, type name, internal endpoint name, repository method, or other implementation detail, rewrite it at the user-facing level before saving.

```markdown
---
title: "{Title} — Test Plan"
date: {YYYY-MM-DD}
status: draft | accepted
---

# {Title} — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows this document is constrained by "what makes all these assertions true?" rather than invented from intuition.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** Describe what the user sees, what the API returns to a caller, what an external observer measures — never internal function calls, return types, or method signatures. If a non-engineer stakeholder couldn't read an assertion and understand it, rewrite it.

### `{promise-name}` — {the promise's sentence}

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | {Behavioral fact — e.g., "Sign-in with an invalid password shows the error 'Invalid credentials'."} | unit |
| A2 | {Behavioral fact — e.g., "Sign-in works against the real identity provider."} | contract |

### Not for a promise

{Assertions that prove no promise, each with why it is still worth a test: a regression guard, a rename, a lesson.}

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A3 | {Behavioral fact — e.g., "Every account created before this change still signs in."} | unit | {a regression guard over existing accounts} |

## Untestable Assertions

{Optional. Include only if the feature has behaviors that cannot be tested within this plan — LLM output quality, paid third-party integrations, UX judgment, behaviors only observable in production traffic. For each, name the reason and what compensating control covers it.}

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | {behavior} | {why no test} | {alert / scheduled review / canary / downstream plan} |

## Notes

- {Open questions about the test approach}
- {Level choices that may need revisiting}
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
test_phases: required
test_levels: required
test_purpose: required
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

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | {one-line assertion — what the test claims is true} | Phase 1 | Phase 1 | planned | unit | promise: {promise-name} | {path/to/the.test.ts} |
| T2 | {another assertion} | Phase 1 | Phase 2 | planned | contract | {a regression guard over … — the reason this row needs no promise} | {path/to/another.test.ts} |

{Optional subsection — include ONLY if this plan has items that are genuinely untestable within its scope. Each row requires all three fields: reason, would require, mitigation.}

### Deferred Verification

- **{short name of the untestable item}**
  - reason: {why this cannot be tested in this plan}
  - would require: {what would unlock a proper test — a new environment, a future plan, production data}
  - mitigation: {compensating control — telemetry alert, scheduled review, downstream plan, canary procedure, feedback signal}

{`### Trajectory Rationale` is the LEGACY shape and belongs only in plans with no test phase. A plan with `### Test Phase 1` puts its justifications in that phase's register instead, and the validator skips this rule entirely — do not author both. The legacy form, for reference: one `- **T3** \`Writable at: Phase 2\` — {reason}` entry per row whose `Writable at` is later than Phase 0.}

## Checklist

### Test Phase 1: {Name — e.g. "Author every assertion, RED"}

**Tier**: {tier — the step's default, or another with its reason}

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [ ] Author {T1, T2, …} against {the subject}, RED
- [ ] Confirm each fails on its own assertion rather than on a missing import

{Include a `#### Deferred to Test Phase N` block for EACH later test phase — required, and the impl is refused without it.}

#### Deferred to Build Phase 2

- **T4** — {why it cannot be authored yet — typically its subject is a symbol Build Phase 2 introduces, so the file would fail to *load* rather than fail an assertion}. Body reviewed:

  ```typescript
  // the deferred test, so the justification is checkable rather than a promise
  ```

{Include `#### Regression Guards` only if some row passes the moment it is written.}

#### Regression Guards

- **T7** — {why it has no red phase and should not be given one}

#### Test Phase 1 Verification

- [ ] {T1, T2, …} are authored, and each red one fails on its own assertion
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

### Build Phase 1: {Name}

**Tier**: {tier — the step's default, or another with its reason}

- [ ] {Task — include code snippets when syntax matters}
  ```typescript
  // Example: function signature that must match this shape
  function withdrawFor(wallet: address, player: address, amount: uint256, historyHash: bytes32)
  ```

{OPTIONAL: #### Build Phase 1 OTel — include ONLY if the project's `otel.role` in `.indusk/config.json` is unset or `"service"`. Skip the entire OTel block for projects with `otel.role: "library" | "tool" | "none"`. Use `shouldEmitOtelGate(projectRoot)` from `apps/indusk-mcp/src/lib/config.ts` to decide.}

#### Build Phase 1 OTel
- [ ] {Instrumentation check — are new code paths observable? See the OTel skill for patterns. Example items: "New endpoints have manual spans with `otel.category` and domain attributes", "Errors recorded with `recordException` + `setStatus(ERROR)` + trace-correlated log". Ask: "did this phase add endpoints, business logic, state transitions, or error paths?" If not, this section can be opted out per gate policy.}

#### Build Phase 1 Verification
- [ ] T1 passes (`{this phase's rows and related tests, e.g. pnpm exec vitest run <the row's test files> && pnpm exec vitest related <files this phase changed>}`) — the whole suite runs at landing, not here
- [ ] T2 flips to `written` state (skipped until Phase 2)

{If a phase has no tests flipping at it, declare it explicitly — NOT silently:}
{- [ ] (no tests flip at this phase — reason: {schema-only | delete | refactor | infra})}

#### Build Phase 1 Context
- [ ] {A rule this phase produces, naming its tier and destination — e.g., "guard: `<test>` carries `lesson: <name>`", "planning: …", "mcp: …", "current.md: …", "root (Conventions): … — always-on because …". An item aimed at the root must say why it must be always-on; one that cannot belongs at a lower tier (see the `/claude-md` tier table). Ask: "what does this phase change about how the project works?" If nothing, omit this section.}

#### Build Phase 1 Document
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

{Shape findings: N raised, M judged wrong by a human. Record both even when zero — an absent number cannot be told apart from a plan that never ran the check, and these counts are the only evidence Shape's judgment quality has.}

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
- **Grep for scoping.** Before writing a brief or impl, search for what depends on what. "How many files import X?" and "What calls this function?" prevent underscoping.
- Keep Y-statements concise but complete. Every field filled in.
- Impl checklists: granular enough to track, not so granular they're busywork.
- When research produces broadly useful insights, also save to `.indusk/research/`.
- Cross-reference related plans by path whenever work overlaps between plans.
- The user's input is: $ARGUMENTS
