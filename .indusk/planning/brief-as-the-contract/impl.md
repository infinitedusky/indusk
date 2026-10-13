---
title: "Brief as the contract — looks in the brief, approval of the brief, amendments, the plan page's parts, a plan that starts as a conversation"
date: 2026-10-12
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Brief as the contract

## Goal

A person works on one document, the brief — promises, expectations and looks — approves it once, and everything after it is the AI's job to make true: a plan's looks are named in its brief and owned by it, approval is of the brief, a change to what was agreed stops the build until a person re-approves it, a plan's page shows its three parts with the agent beside them, and a plan starts as a conversation held outside the repository and is named once its promises are clear (ADR decisions 1–10).

## Scope

### In Scope
- A `## Looks` section in the brief, parsed by the contract check; the planner skill, the brief template and the planning rules carrying it.
- `plan` on approval entries; `plans approve` recording the brief's hash and refusing a proposed mockup its brief names; the interface check over `Files Affected` and, at accept, over the diff.
- `amendmentsOf`, the `check-gates.js` refusal, `indusk plans reapprove`, its route and button.
- `plans/parts`, the plan page's three parts, the review's evidence group.
- Drafts in the project's home, `plans start --from-draft`, the conversation entry, removal of the New plan form, ageing.

### Out of Scope
- Looks matched against mockups ([mockup-matching](../mockup-matching/brief.md)) and scenarios per behaviour promise ([demo-scenarios](../demo-scenarios/brief.md)).
- A promise file per look; screen-level stories for the admin's mockup states.
- Changing what a spike requires: `workflow-types` is unchanged.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `fixtures/brief-app/`; red CLI-boundary tests for the Looks section, ownership, the approval gate, amendments and the form; the register | today's `indusk plans` and `promises contract` |
| Build Phase 1 | `looks` in `parseBriefContract`; the interface check at approval and accept; the planner skill, brief template and planning rules | the contract check, `screens.json` `sources`, the impl's `Files Affected` |
| Build Phase 2 | `plan` on approval entries; `approved_brief`, `approved_by`, `approved_at`; the mockup-approved gate in `plans approve` | Build Phase 1's `looks` |
| Build Phase 3 | `plans/amendments`, the `check-gates.js` refusal, `plans reapprove`, its route; the `a-plan-builds-only-after-approval` change | Build Phase 2's `approved_brief` |
| Build Phase 4 | this plan's own looks drawn and approved; `plans/parts`, the plan page's three parts, the amendment Approve, the review's evidence group | Build Phases 1–3 |
| Build Phase 5 | `lib/drafts`, `plans start --from-draft`, the conversation entry and drafts list, the form removed, ageing | Build Phase 4's page, the session module |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan that changes files under an app's interface, whose brief lists no look and gives no reason, is refused at approval, and the refusal names what is missing | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-brief-lists-its-looks | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A2 | A brief that says "None — {reason}" for its looks is approved when the plan changes nothing under an app's interface | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-brief-lists-its-looks | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A3 | A look listed under makes, changes, replaces or must-not-break is read as that, so the plan page and the check say the same thing the brief does | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-brief-lists-its-looks | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A4 | A look approved in a plan's checkout records that plan, and reading the approval shows it | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-look-has-the-plan-that-owns-it | apps/indusk-mcp/src/__tests__/look-ownership.test.ts |
| A5 | A plan's page lists the looks it owns beside its promises, each with its approval | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-look-has-the-plan-that-owns-it | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A6 | A plan that redraws an approved look shows it as proposed while the old version is still the one the app is held to | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-changed-look-keeps-its-history | apps/indusk-mcp/src/__tests__/look-ownership.test.ts |
| A7 | After a person approves the new version, the record shows both versions and the plan that changed it | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-changed-look-keeps-its-history | apps/indusk-mcp/src/__tests__/look-ownership.test.ts |
| A8 | Approving a plan whose brief names a look that is still proposed is refused, naming the look; once that look is approved the same plan is approved | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-is-approved-with-its-looks-approved | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A9 | An approval records the brief the person approved, and a brief edited afterwards reads as changed since its approval | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-is-of-the-brief | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A10 | The review shows the test plan, the ADR and the impl as evidence beside the approval, and asks for no separate sign-off on them | Build Phase 4 | Build Phase 4 | planned | unit | promise: approval-is-of-the-brief | apps/indusk-mcp/src/__tests__/review-evidence.test.ts |
| A11 | A promise's statement, an expectation or a look changed after approval is listed on the plan page as waiting on the person, with what it was and what it is now | Test Phase 1 | Build Phase 3 | written | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A12 | While an amendment is waiting, no build item can be checked off; when the person approves it, the build goes on and the review shows both versions | Test Phase 1 | Build Phase 3 | written | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A13 | An amendment is approved only by a person in their browser: the same request from a script or an agent is refused | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-admin/src/__tests__/amendment-approval.test.ts |
| A14 | A change to an impl item, a note or a Shape finding after approval is recorded in the impl and waits for nobody | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A15 | A plan's page shows its promises, expectations and looks, each with its name and state, and a link one click down to the brief | Build Phase 4 | Build Phase 4 | planned | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A16 | A look the agent draws while a person is on the plan's page appears there, at each reference device and proposed, in a real browser | Build Phase 4 | Build Phase 4 | planned | contract | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/plan-parts.contract.test.ts |
| A17 | A promise or a look written by the agent in a live planning session appears on the page without the person leaving it | Build Phase 4 | Build Phase 4 | planned | live check | promise: a-plan-page-shows-the-parts-of-its-brief | manual: recorded in Build Phase 4's Verification |
| A18 | The page for starting a plan asks for no name and no type before the conversation begins | Test Phase 1 | Build Phase 5 | written | unit | promise: a-plan-starts-as-a-conversation | apps/indusk-admin/src/components/session/NewPlanForm.test.tsx |
| A19 | Accepting the agent's proposed name and type creates the plan on its own branch and worktree with the draft as its brief; a name already taken is refused and another is asked for | Build Phase 5 | Build Phase 5 | planned | unit | promise: a-plan-starts-as-a-conversation | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A20 | A conversation not kept leaves no file in any checkout or branch of the project; it is listed on the page as a draft that can be reopened or discarded | Build Phase 5 | Build Phase 5 | planned | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A21 | A kept conversation that makes promises or looks becomes a plan with a brief; one that makes neither becomes a research-only plan with no brief | Build Phase 5 | Build Phase 5 | planned | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A22 | A brief written before this rule, with no looks section, is still approved when its plan changes nothing under an app's interface | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over every plan already written | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A23 | Starting a plan from the terminal (`indusk plans start`) works as before | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the form goes, the command stays | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |

### Deferred Verification

- **Starting by talking feels more natural than a form (test plan U1)**
  - reason: a person's experience, not an observable rule
  - would require: using it on real plans
  - mitigation: expectation 2 records whether approval was made from the brief alone, in each of the first three plans' retrospectives
- **The agent proposes a name and type that suit the plan (test plan U2)**
  - reason: the quality of a model's proposal cannot be asserted
  - would require: a person reading it
  - mitigation: the person accepts or edits every proposal at the moment it is made (A19)

## Checklist

### Test Phase 1: Author the CLI-boundary assertions, RED

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored against today's `indusk` commands and components, and record every test whose subject does not exist yet.

- [x] Confirm this plan's worktree (`indusk plans start` made it; `indusk worktree list` shows `brief-as-the-contract`) — worktree-per-plan default, no `worktree: none` in the frontmatter
  - Note: `indusk worktree list` refuses outside a workbench; `git worktree list` shows `/Users/the_dusky/code/sandbox/dusk-worktrees/brief-as-the-contract` on `plan/brief-as-the-contract`, and the frontmatter has no `worktree: none`.
- [x] `apps/indusk-mcp/src/__tests__/fixtures/brief-app/`: a git project with an app's `.indusk/mockups/demo/` (`screens.json` with `sources`, one approved and one proposed mockup), a plan folder whose impl names a file under those sources in `Files Affected`, and briefs in the three shapes (looks listed, `None — {reason}`, no section)
- [x] Author A1, A3, A4, A8, A9, A11, A12 and A18 against the fixture and the existing components, each failing on its own assertion (a refusal that is not given, a field that is not there, a form that asks for a name)
- [x] Author A2, A6, A14, A22 and A23, which pass today and are the regression guards
- [x] Confirm each red fails on its assertion rather than on a missing import
  - Result: each red read, none a load error. A1 and A8: `plans approve` exits 0 where the test expects a refusal (`expected +0 not to be +0`). A3: `parseBriefContract` returns no `looks` property (`expected {...} to have property "looks"`). A4: the approved entry has no `plan` (`expected undefined to be 'x'`). A9: the impl has no `approved_brief` (`expected undefined to be '<sha256>'`). A11 (three parts) and A12: `check-gates.js` exits 0 where the test expects 2 (`expected +0 to be 2`). A18: the entry still renders the name input (`expected [ <input> ] to have a length of +0 but got 1`). Guards A2, A6, A14, A22 and A23 pass. Subjects are reached over the CLI, a spawned hook, the filesystem and symbols that exist (`parseBriefContract`, `approve`, `readApp`); no import is of a file this plan creates.

#### Deferred to Build Phase 2

- **Authored at Build Phase 2's start** (`look-ownership.test.ts`, RED on `expected undefined to be 'x'`). Corrected per the review: it redraws `home.empty` (the fixture's approved look) and approves it from the plan checkout, so the record holds the fixture's plan-less entry and the new one carrying the plan taken from the checkout's branch.

- **A7** — asserts the record's `plan` field, which Build Phase 2 adds to the entry type; before then the test file would read a field no type declares. Body reviewed:

  ```typescript
  it("A7 the record keeps both versions and the plan that changed the look", async () => {
    approveInPlanCheckout("plan.working", { plan: "brief-as-the-contract" });
    redraw("plan.working");
    approveInPlanCheckout("plan.working", { plan: "brief-as-the-contract" });
    const entries = readApprovals(app).filter((e) => e.mockup === "plan.working");
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.plan)).toEqual(["brief-as-the-contract", "brief-as-the-contract"]);
    expect(entries[0].mockupHash).not.toBe(entries[1].mockupHash);
  });
  ```

#### Deferred to Build Phase 3

- **A13** — the amendment route is Build Phase 3's; a handler import that does not resolve is a load error, not a red. Body reviewed:

  ```typescript
  it("A13 an amendment is approved only from the person's browser", async () => {
    const script = await reapprove(request({ fetchSite: null }));
    expect(script.status).toBe(403);
    const browser = await reapprove(request({ fetchSite: "same-origin" }));
    expect(browser.status).toBe(200);
  });
  ```

#### Deferred to Build Phase 4

- **A5, A15** — `PlanParts` and `plans/parts` are Build Phase 4's; the page test imports the component. Bodies reviewed:

  ```typescript
  it("A15 the plan page shows its promises, expectations and looks", async () => {
    const html = await planPage({ plan: "brief-as-the-contract" });
    for (const part of ["promises", "expectations", "looks"]) expect(html).toContain(`data-part="${part}"`);
    expect(html).toContain(`href="/p/${PROJECT}/plan/brief-as-the-contract/brief"`);
  });
  it("A5 a plan's looks are listed beside its promises with their approval", async () => {
    const html = await planPage({ plan: "brief-as-the-contract" });
    expect(attrOf(lookRow(html, "plan.working"), "data-approval")).toBe("proposed");
  });
  ```

- **A10** — the evidence group is added to `buildReview` in Build Phase 4. Body reviewed:

  ```typescript
  it("A10 the review shows the other documents as evidence, with no sign-off on them", () => {
    const review = buildReview(fixturePlan());
    expect(review.evidence.map((e) => e.document)).toEqual(["test-plan", "adr", "impl"]);
    expect(review.evidence.every((e) => e.signoff === undefined)).toBe(true);
  });
  ```

- **A16** — the frame on the plan page is Build Phase 4's; a contract over a real browser. Body reviewed:

  ```typescript
  it("A16 a look drawn while the page is open appears there at each device", async () => {
    await open(page, `/p/${PROJECT}/plan/brief-as-the-contract`);
    writeMockup("plan.working", html);
    await expect(page.locator('[data-testid="plan-look"][data-look="plan.working"]')).toBeVisible({ timeout: 15_000 });
    for (const device of devices) await expectFrameWidth(page, "plan.working", device);
  });
  ```

- **A17** — a live check against the developer's own `claude`, recorded once in Build Phase 4's Verification.

#### Deferred to Build Phase 5

- **A19, A20, A21** — `lib/drafts` and `--from-draft` are Build Phase 5's. Bodies reviewed:

  ```typescript
  it("A19 accepting the proposal makes the plan on its own branch with the draft as its brief", async () => {
    const draft = createDraft(home, { brief: "# draft" });
    writeProposal(draft, { name: "phone-nav", type: "bugfix" });
    await startFromDraft(project, draft);
    expect(branchExists("plan/phone-nav")).toBe(true);
    expect(read(worktree("phone-nav"), ".indusk/planning/phone-nav/brief.md")).toContain("# draft");
    await expect(startFromDraft(project, createDraftNamed("phone-nav"))).rejects.toThrow(/already/);
  });
  it("A20 a conversation not kept leaves nothing in any checkout", () => {
    const draft = createDraft(home, { brief: "# draft" });
    expect(gitStatusAcrossWorktrees(project)).toEqual([]);
    expect(listDrafts(home).map((d) => d.id)).toContain(draft.id);
    discardDraft(home, draft.id);
    expect(listDrafts(home)).toEqual([]);
  });
  it("A21 a kept conversation with no promises or looks becomes research alone", async () => {
    const draft = createDraft(home, { research: "# notes" });
    writeProposal(draft, { name: "remember-this", type: "spike" });
    await startFromDraft(project, draft);
    expect(exists(worktree("remember-this"), ".indusk/planning/remember-this/research.md")).toBe(true);
    expect(exists(worktree("remember-this"), ".indusk/planning/remember-this/brief.md")).toBe(false);
  });
  ```

#### Regression Guards

- **A2** — the "None — {reason}" brief is approved today because nothing reads a looks section; it must keep passing when Build Phase 1 starts reading one.
- **A6** — a redrawn approved look reads proposed with its `reference` today (`Approval.state: proposed`); it must keep doing so when ownership is added.
- **A14** — an impl-level change after approval waits for nobody today; it must keep doing so when amendments are detected.
- **A22** — a brief with no looks section is approved today; the guard for every plan already written.
- **A23** — `indusk plans start` works today; the form goes and the command stays.

#### Test Phase 1 Verification

- [x] A1, A3, A4, A8, A9, A11, A12 and A18 are authored and each fails on its own assertion; A2, A6, A14, A22 and A23 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/brief-looks.test.ts src/__tests__/look-ownership.test.ts src/__tests__/plans-approve-looks.test.ts src/__tests__/amendments.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/session/NewPlanForm.test.tsx`)
  - Result: `pnpm build` (tsc) clean; the four mcp files ran 14 tests, 9 red and 5 green; `NewPlanForm.test.tsx` ran 3, 1 red (A18) and 2 green (the existing workbench-repo rows). Red: A1 (`plans approve` exits 0), A3 (no `looks` on the parsed brief), A4 (entry has no `plan`), A8 (approval not refused), A9 (no `approved_brief`), A11 x3 and A12 (`check-gates.js` exits 0, not 2), A18 (name input rendered). Green: A2, A6, A14, A22, A23. `indusk promises contract brief-as-the-contract` agrees; `indusk promises check` passes; biome clean on the new files.
- [x] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?
  - Review (each body is a note for its phase to correct when it is authored; none blocks Test Phase 1):
    - **A7** compiles at Build Phase 2 once `plan` is on the entry. Two defects: `plan.working` is not in the `brief-app` fixture (use `home.empty`, redrawn by appending to its html, then approved from a second plan's checkout), and `approveInPlanCheckout(..., { plan })` passes the plan by argument where ADR decision 3 takes it from the checkout's branch. Asserting the same plan twice does not show "the plan that changed it"; the redraw belongs to a different plan than the first approval.
    - **A13** compiles at Build Phase 3 (the route exists then). It asserts the header guard, which a script can set; that matches ADR decision 6 (a tripwire as the look approval's is) and the claim "refused from a script or an agent" holds only for a request without `Sec-Fetch-Site: same-origin`. The 200 arm needs an approved plan with an amendment as its fixture, which the body does not name.
    - **A10** does not compile as written: `buildReview(anyCheckout, plan)` is async and takes a checkout and a plan name; the body calls it with one synchronous argument. It should `await buildReview(checkout, plan)` in an async `it`. "Beside the approval" is not asserted, only the evidence list and absent `signoff`.
    - **A15** asserts `href=".../plan/<plan>/brief"`, a route that does not exist (the plan page has only `page.tsx`); Build Phase 4 must either add it or the body should assert the brief link as built. "Each with its name and state" is claimed and not asserted: the body checks the three `data-part` attributes only.
    - **A5** asserts one look's `data-approval`; "beside its promises" is not asserted. Compiles at Build Phase 4 given a `planPage` helper nothing defines yet.
    - **A16** compiles at Build Phase 4 with `open`, `writeMockup`, `devices` and `expectFrameWidth` supplied; "and proposed" is claimed and not asserted (only visibility and width).
    - **A17** is a live check, no body.
    - **A19** compiles at Build Phase 5 if `lib/drafts` exports `createDraft`, `writeProposal` and `startFromDraft`; `createDraftNamed` is undefined and the taken-name arm creates a draft with no proposal, so it would reject for a missing proposal rather than "already". Write a proposal naming `phone-nav` into the second draft. "Another is asked for" is not asserted; "its own worktree" is not asserted (only the branch and the brief).
    - **A20** compiles at Build Phase 5; `gitStatusAcrossWorktrees` checks working trees, not branches, so "no file in any checkout or branch" is half asserted, and "can be reopened" is not asserted (only listed and discarded).
    - **A21** asserts only the research-only arm (and keys it on `spike`); the arm "promises or looks becomes a plan with a brief" is covered by A19's `brief.md` read but not named under A21.

### Build Phase 1: The Looks section in the brief

**Tier**: med — the work step's default

- [x] `parseBriefContract` (`apps/indusk-mcp/src/lib/promises/`) reads an optional `## Looks` section with `### This plan makes`, `### Existing looks` (**Must not break**, **Changes**, **Replaces**) and `None — {reason}`, returned as `looks`; a brief with none returns `looks: null`
- [x] `checkPlanContract` refuses, at approval, a plan whose impl's `Files Affected` names a path under an app's declared interface (`sources` in each `.indusk/mockups/<app>/screens.json`) while its brief lists no look and gives no reason, naming the paths and what is missing; a brief with no section and no such path is untouched
- [x] `plans accept` runs the same check over the branch's diff against the trunk and refuses a plan whose brief says `None` but which changed those files, naming them; the message names the amendment as the way forward
- [x] The planner skill (`apps/indusk-mcp/skills/planner.md`), the brief template (`templates/workflows/`) and the planning rules template (`templates/planning/CLAUDE.md`): the Looks section, the question "does this change how anything looks?" asked after the draft brief, a story named directly or with a draft mockup, and that approval waits on the mockups it names
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Result: 11 files reviewed (6 code, 5 prose); one finding (below), one left as-is; the duplicated "no section or None" wording in `accept.ts` and `contract.ts` is cross-file and left to `/cleanup`.
- [x] Shape (`apps/indusk-mcp/src/lib/promises/contract.ts`) — name what is missing from a brief's looks as a function (`lookGap`) instead of a nested ternary inside `lookRefusals`. Rule: Should this inline block have been a named function? (shape: intra-unit naming)
- [x] Shape (`apps/indusk-mcp/src/lib/promises/interface-files.ts`) — reviewed, left as-is: `filesAffectedOf` is one parser with one reason to change and its cell regex is commented by its docblock; splitting it would name steps no test reaches separately

#### Build Phase 1 Verification

- [x] A1 and A3 pass and A2, A22 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/brief-looks.test.ts`); `pnpm exec vitest related` over the changed files; `indusk promises contract brief-as-the-contract` and `indusk promises check` pass; tsc and biome clean on changed files
  - Result: `pnpm build` clean; `brief-looks.test.ts` 4 of 4 (A1, A3 now pass; A2, A22 still pass); `vitest related` over the changed files 18 files, 127 tests pass; with the worktree-built CLI `promises contract brief-as-the-contract` reports the brief, rows and registry agree and `promises check` passes (113 promises); tsc and biome clean on changed files.
  - Decision: Build Phase 1's own check refused this plan's brief, because Files Affected names admin files and the brief listed no look. The user, asked whether to list the looks now, put a temporary None, or narrow the check, chose "List the looks now"; the brief's `## Looks` lists them.

#### Build Phase 1 Context

- [x] planning: `apps/indusk-mcp/templates/planning/CLAUDE.md` — a brief holds expectations, promises and looks; a plan that changes an app's interface lists its looks or says why not — guarded by `brief-looks.test.ts` (A1)

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/briefs.md`: the Looks section and the question, with the draft → accepted → looks approved → approved flow in Mermaid

### Build Phase 2: A look belongs to a plan, and approval is of the brief

**Tier**: med — the work step's default

- [x] `ApprovalEntry` and `StoryApprovalEntry` gain an optional `plan`; `approve()` takes the plan from the checkout it is called in and writes it; the admin's approve route passes the checkout it was sent
  - Note: the admin's approve route needed no change: it already passes `checkout.root`, and `approve()` reads the plan from that checkout's branch (`plan/x` becomes `x`; the project's own checkout records none).
- [x] `plans approve` writes `approved_brief: <sha256 of brief.md>`, `approved_by` and `approved_at` to the impl's frontmatter beside `status: approved`
  - Note: the three values are written as quoted strings (a hash of digits and one `e` is a YAML number, a bare timestamp a date). Workbench plans record the brief too. Code: `lib/plans/approved-brief.ts`.
- [x] `plans approve` refuses, naming the look, when a mockup its brief makes, changes or replaces is not approved in the worktree's record; a story it names is exempt
  - Decision: a name that is neither a mockup nor a story drawn in the worktree is not held (nothing to approve yet). `A8`'s fixture brief also *changes* `detail.default`, a proposed mockup, so the test's arrange step now approves both looks the brief names; its assertions are unchanged. Not applied to workbench plans (their looks live in the code repo, not at the root).
- [x] `looks/overview` returns each approval's `plan`, so a plan's looks can be read by owner
- [x] A brief edited after approval reads as changed since its approval (the comparison `amendmentsOf` builds on in Build Phase 3)
  - `briefStandingOf(planDir)` returns `unapproved`, `unchanged` or `changed` from the impl's recorded hash; guarded by `approved-brief.test.ts`.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Result: 8 files reviewed (5 code, 3 tests); one finding (below), one left as-is.
- [x] Shape (`apps/indusk-mcp/src/lib/plans/approve.ts`) — name the mockup-approval refusal as a function (`refuseUnapprovedLooks`) instead of an inline block inside `approvePlan`. Rule: Should this inline block have been a named function? (shape: intra-unit naming)
- [x] Shape (`apps/indusk-mcp/src/lib/plans/approved-brief.ts`) — reviewed, left as-is: one concern, the approval record (hash, who, frontmatter, what approval waits on, standing); `approvedBy` repeats `approver` in `looks/approve.ts`, which the write-side rule keeps out of `lib/plans` imports, so that duplication is cross-file and left to /cleanup

#### Build Phase 2 Verification

- [x] A4, A7, A8 and A9 pass and A6 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/look-ownership.test.ts src/__tests__/plans-approve-looks.test.ts`); the package's looks tests and `plans` tests pass; tsc and biome clean on changed files
  - Result: `pnpm build` clean; `look-ownership.test.ts` (A4, A6, A7 and the overview's plan) and `plans-approve-looks.test.ts` (A8, A9, A23) and `approved-brief.test.ts` pass, 10 tests; `vitest related` over the 5 changed source files ran 21 files, 153 tests, all green (one `release-incident.test.ts` A12 timed out at 5s under the parallel load and passed 6 of 6 alone); tsc clean in `indusk-mcp` and `indusk-admin`; biome clean on changed files.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/src/lib/looks/CLAUDE.md`: an approval entry records the plan it was made in; the record stays append-only — guarded by `look-ownership.test.ts` (A4, A7)

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: `approve` records the brief and refuses a proposed mockup; `apps/docs/src/guide/ui-promises.md`: a look belongs to the plan that made it

### Build Phase 3: An amendment waits for the person

**Tier**: strong — edits `check-gates.js`, the gate every plan's build passes through

- [ ] `apps/indusk-mcp/src/lib/plans/amendments.ts`, exported as `./plans/amendments`: `amendmentsOf(plan)` compares the brief's expectations, promises and looks, and each owned promise's statement, to those at `approved_brief` (read with `git show` of the approval commit, as `plans audit-inputs` does) and returns `{part, name, was, now}` per difference; the test plan, ADR, impl, notes and Shape findings are not compared
- [ ] `hooks/check-gates.js` refuses to check off a build item while `amendmentsOf` is non-empty, naming each amendment and the command that resolves it (`lesson: a-plan-builds-only-after-approval`)
- [ ] `indusk plans reapprove <name>`: refused before approval; runs the contract check; sets `approved_brief` to the current hash; appends each amendment (what it was, what it is, by, at) to `plan-history/<plan>.md`
- [ ] `apps/indusk-admin/src/app/api/plans/[name]/reapprove/route.ts`: `adminOnly` first, then the same `Sec-Fetch-Site: same-origin` guard the look approval has; calls `reapprove` through the package
- [ ] `indusk promises change a-plan-builds-only-after-approval --plan brief-as-the-contract --statement "A plan leaves draft only through indusk plans approve, and no build item is checked off on a plan that is not approved or that has an amendment waiting." --reason "an amendment waits for the person"`
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 3 Verification

- [ ] A11, A12 and A13 pass and A14 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/amendments.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/amendment-approval.test.ts`); the hooks' tests (`apps/indusk-mcp/hooks`) pass; `indusk promises check` passes; tsc and biome clean on changed files

#### Build Phase 3 Context

- [ ] guard: `check-gates.js`'s refusal carries `lesson: a-plan-builds-only-after-approval` and its test is `amendments.test.ts` (A12); `apps/indusk-mcp/hooks/CLAUDE.md`: an amendment, not an impl edit, is what stops a build

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/cli/plans.md`: `plans reapprove` and what counts as an amendment; `apps/docs/src/guide/briefs.md`: changing what was agreed during a build

### Build Phase 4: The plan page shows the parts of its brief

**Tier**: med — the work step's default

- [ ] Draw the mockups for the looks the brief already lists (`plan.parts`, `plan.drafts`, `plan.new`, and the changed `plan.needs-you`, `plan.working`, `plan.released`) on the admin's foundation composed of its components
- [ ] **Pause for a person**: Sandy approves this plan's mockups on the Looks page and the amendment on the plan page (Deferred Verification U1)
- [ ] `apps/indusk-mcp/src/lib/plans/parts.ts`, exported as `./plans/parts`: for a plan, its promises (the registry rows it owns), expectations (parsed from the brief) and looks (the brief's list joined to `looks/overview`'s approval, with `plan`); the amendments waiting
- [ ] `apps/indusk-admin/src/components/plan/PlanParts.tsx`: promises, expectations and looks as three parts with names and states first, each look drawn at the reference devices with the Looks page's frame and proposed until approved there, the brief one link below, and each waiting amendment with Approve calling `plans reapprove`'s route
- [ ] `buildReview` returns an `evidence` group holding the test plan, ADR and impl, shown on the review with no control to sign them off
- [ ] The page refreshes on the existing `LiveRefresh` so what the agent writes appears; a look file change is read on the next refresh
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 4 Verification

- [ ] A5, A10 and A15 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/review-evidence.test.ts`); A16 passes in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/plan-parts.contract.test.ts`, listed in `SYSTEM`)
- [ ] A17, live check: with the admin running, start a planning session from this plan's page, ask the agent to add a promise and draw a look, and see both appear without leaving the page — recorded here with the date and what was seen
- [ ] The admin's everyday suite passes; `indusk looks check admin` reads every checked look held; tsc and biome clean on changed files

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: a plan's page shows its three parts from `plans/parts` and computes none — guarded by `cockpit-single-definition.test.ts` and `plan-parts.test.tsx` (A15)

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the plan page's parts, the amendment Approve, the review's evidence

### Build Phase 5: A plan starts as a conversation

**Tier**: med — the work step's default

- [ ] `apps/indusk-mcp/src/lib/drafts/`, exported as `./drafts`: create, list, read, write the proposal (`{name, type}`), discard and age out drafts under `<project home>/drafts/<id>/`; `drafts.max_age_days` (default 30) in `.indusk/config.json`, swept by `archive-dead`
- [ ] `indusk plans start <type> <name> --from-draft <id>`: creates the branch and worktree, writes the draft in as `brief.md` (or `research.md` for `spike`), removes the draft; refuses a name already taken; `plans start` without the flag is unchanged
- [ ] The session module runs a draft's conversation with the draft folder as its working directory, so it reads and writes nothing in a checkout; the planning rules it runs under are the planner's
- [ ] The admin's "New" opens an empty draft and its conversation; the draft page shows the proposal with Accept and Edit; the project page lists drafts with Reopen and Discard
- [ ] Remove `NewPlanForm.tsx` and its route's name-first path; A18's test asserts the entry asks for nothing
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 5 Verification

- [ ] A18, A19, A20 and A21 pass and A23 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/drafts.test.ts src/__tests__/plans-approve-looks.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/session`); the admin's everyday suite and both packages' tests pass; tsc and biome clean on changed files

#### Build Phase 5 Context

- [ ] `.indusk/current.md`: a plan starts as a draft held in the project's home; the New plan form is gone — and root (Key Decisions): "Brief as the contract: looks in the brief, approval of the brief, an amendment stops the build until a person re-approves, a plan starts as a conversation — see `/decisions/brief-as-the-contract`" — always-on because it is design intent every plan is written under

#### Build Phase 5 Document

- [ ] `apps/docs/src/decisions/brief-as-the-contract.md` published from the ADR; `apps/docs/src/guide/briefs.md` and `reference/cli/plans.md` (`start --from-draft`); sidebar entries; changelog: Added — "The brief is the contract: looks belong to a plan, approval is of the brief, a change to what was agreed waits for the person, the plan page shows promises, expectations and looks, and a plan starts as a conversation."

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/` (contract, brief parser) | `looks` section; the interface check |
| `apps/indusk-mcp/src/lib/looks/approvals.ts`, `approve.ts`, `overview.ts` | `plan` on entries |
| `apps/indusk-mcp/src/lib/plans/{approve,accept,amendments,parts,start}.ts` | approved brief, mockup gate, amendments, parts, `--from-draft` |
| `apps/indusk-mcp/src/lib/drafts/` | new |
| `apps/indusk-mcp/hooks/check-gates.js` | amendment refusal |
| `apps/indusk-mcp/skills/planner.md`, `templates/` | the Looks section and the question |
| `apps/indusk-admin/src/app/api/plans/[name]/reapprove/route.ts` | new |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | new |
| `apps/indusk-admin/src/components/session/NewPlanForm.tsx` | removed |
| `.indusk/mockups/admin/` | this plan's looks |
| `apps/docs/src/**` | guide, reference, decision, changelog |

## Dependencies
- storybook-components closed 2026-10-12: looks include stories, a changed component reopens its mockups, and the frame the plan page reuses.
- `plans audit-inputs`'s reading of the approval commit, and the plan-history record.

## Notes
- This plan's own looks (`plan.parts`, `plan.drafts`, `plan.new`, and the changed `plan.*` screens) were listed in its brief at Build Phase 1, once the check fired on this plan's own Files Affected; Sandy approves their mockups in Build Phase 4.
- `plans reapprove` from a terminal is the person's by convention, as `plans approve` is; only the cockpit's route is guarded by the browser's fetch metadata.
- A story named in a brief is exempt from the mockup-approved gate: it is approved at the build, as storybook-components Build Phase 5 was.
