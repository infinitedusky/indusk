---
title: "Brief as the contract — looks in the brief, approval of the brief, amendments, the plan page's parts, a plan that starts as a conversation"
date: 2026-10-12
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
accepted: 2026-10-13T23:05:42.680Z
accepted_by: person
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
| A5 | A plan's page lists the looks it owns beside its promises, each with its approval | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-look-has-the-plan-that-owns-it | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A6 | A plan that redraws an approved look shows it as proposed while the old version is still the one the app is held to | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-changed-look-keeps-its-history | apps/indusk-mcp/src/__tests__/look-ownership.test.ts |
| A7 | After a person approves the new version, the record shows both versions and the plan that changed it | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-changed-look-keeps-its-history | apps/indusk-mcp/src/__tests__/look-ownership.test.ts |
| A8 | Approving a plan whose brief names a look that is still proposed is refused, naming the look; once that look is approved the same plan is approved | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-is-approved-with-its-looks-approved | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A9 | An approval records the brief the person approved, and a brief edited afterwards reads as changed since its approval | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-is-of-the-brief | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A10 | The review shows the test plan, the ADR and the impl as evidence beside the approval, and asks for no separate sign-off on them | Build Phase 4 | Build Phase 4 | passing | unit | promise: approval-is-of-the-brief | apps/indusk-mcp/src/__tests__/review-evidence.test.ts |
| A11 | A promise's statement, an expectation or a look changed after approval is listed on the plan page as waiting on the person, with what it was and what it is now | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A12 | While an amendment is waiting, no build item can be checked off; when the person approves it, the build goes on and the review shows both versions | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A13 | An amendment is approved only by a person in their browser: the same request from a script or an agent is refused | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-admin/src/__tests__/amendment-approval.test.ts |
| A14 | A change to an impl item, a note or a Shape finding after approval is recorded in the impl and waits for nobody | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/amendments.test.ts |
| A15 | A plan's page shows its promises, expectations and looks, each with its name and state, and a link one click down to the brief | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A16 | A look the agent draws while a person is on the plan's page appears there, at each reference device and proposed, in a real browser | Build Phase 4 | Build Phase 4 | passing | contract | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/__tests__/plan-parts.contract.test.ts |
| A17 | A promise or a look written by the agent in a live planning session appears on the page without the person leaving it | Build Phase 5 | Build Phase 5 | passing | live check | a live check of a-plan-page-shows-the-parts-of-its-brief, recorded in Build Phase 5; the promise is proven by its unit and contract rows (A15, A16) | manual: recorded in Build Phase 5's Verification |
| A18 | The page for starting a plan asks for no name and no type before the conversation begins | Test Phase 1 | Build Phase 5 | passing | unit | promise: a-plan-starts-as-a-conversation | apps/indusk-admin/src/components/session/NewPlanForm.test.tsx |
| A19 | Accepting the agent's proposed name and type creates the plan on its own branch and worktree with the draft as its brief; a name already taken is refused and another is asked for | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-plan-starts-as-a-conversation | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A20 | A conversation not kept leaves no file in any checkout or branch of the project; it is listed on the page as a draft that can be reopened or discarded | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A21 | A kept conversation that makes promises or looks becomes a plan with a brief; one that makes neither becomes a research-only plan with no brief | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/__tests__/drafts.test.ts |
| A22 | A brief written before this rule, with no looks section, is still approved when its plan changes nothing under an app's interface | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over every plan already written | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A24 | Approving a plan whose brief names a look that is not drawn in its worktree is refused, naming the look; a new component is named by its own mockup, so no name is exempt | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-plan-is-approved-with-its-looks-approved | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A25 | Accepting a plan is refused while a new component its brief names has no approved story, or a mockup its brief names still draws a component inline or composes one not approved, naming each; once the stories are approved the same plan is accepted | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-new-component-ends-its-plan-with-a-story | apps/indusk-mcp/src/__tests__/plans-accept-stories.test.ts |
| A23 | Starting a plan from the terminal (`indusk plans start`) works as before | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the form goes, the command stays | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts |
| A26 | A planning session (a draft's conversation or a plan's brief) asks nothing for a write inside its own folder, and a write outside it reaches the person: it never runs in `bypassPermissions`, where a draft's agent can write into the repository unasked | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/lib/session/permissions.test.ts, apps/indusk-mcp/src/lib/session/protocol.test.ts |
| A27 | A brief's `description:` written as YAML — a folded block (`>-`) or a quoted string with an escaped quote — shows as its text on the plan page, not as `>-` or a stray backslash | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-mcp/src/__tests__/plan-parts-description.test.ts |
| A28 | A brief whose status is finished by the rail's own rule (`complete`, `accepted`) or that is `superseded`, or any archived plan, never shows "The brief is incomplete" as the current step | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-plan-page-shows-the-parts-of-its-brief | apps/indusk-admin/src/components/plan/PlanSummary.test.tsx |
| A29 | A file edited in place inside an archived plan's folder is read on the next request; the archive cache never serves the old text | Build Phase 6 | Build Phase 6 | passing | unit | a regression guard: the archive cache never serves a stale plan | apps/indusk-admin/src/lib/planning-reader.archive-cache.test.ts |
| A30 | Accepting a draft as a `spike` lands on the plan's page, not on a brief page that asks for a brief a spike never has | Build Phase 6 | Build Phase 6 | passing | unit | promise: a-plan-starts-as-a-conversation | apps/indusk-admin/src/components/drafts/DraftProposal.test.tsx |
| A31 | On a phone, where the brief page is one column, the agent column under the brief is given no window-fitted height, so it is not clipped while it scrolls into view | Build Phase 6 | Build Phase 6 | passing | unit | a regression guard: the agent column is fitted only beside the brief | apps/indusk-admin/src/components/session/WindowColumn.test.tsx |
| A32 | `readPlanPage(project, name)` gives the three plan routes (the plan page, the brief page, a document page) their plan: an active plan over an archived one of the same name, null for a project whose path is gone, and not-found for a plan that does not exist | Build Phase 7 | Build Phase 7 | passing | unit | a regression guard: the plan routes find their plan one way | apps/indusk-admin/src/lib/plan-page.test.ts |
| A33 | Approving, re-approving and accepting a workbench plan run the same looks checks a normal plan does: a look its brief names still proposed refuses approval and re-approval, an interface change against a brief listing no look refuses acceptance, and a new component with no approved story refuses acceptance — each naming what is missing | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-plan-is-approved-with-its-looks-approved | apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts, apps/indusk-mcp/src/__tests__/plans-accept-stories.test.ts |
| A34 | A `## Files Affected` row whose path cell carries a note after the path, or two paths, is read path by path: an interface path among them is caught at approval like a bare one | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-brief-lists-its-looks | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |
| A35 | While an amendment waits, a `<!-- skip-gates -->` marker does not let a build item be checked off; and an impl edit that removes `approved_brief:` from an approved plan is refused, so the amendment gate cannot be switched off from the impl | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person | apps/indusk-mcp/src/__tests__/check-gates-amendments.test.ts |
| A36 | A draft past its age is moved to the home's archive of drafts, not deleted; and accepting a draft that holds both a brief and research keeps both in the new plan | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository | apps/indusk-mcp/src/__tests__/drafts.test.ts, apps/indusk-mcp/src/__tests__/drafts-age.test.ts |
| A37 | The Looks rule is held at approval: the registry check (`indusk promises check`, run by `pnpm test`) does not refuse a plan already approved whose brief has no Looks section though its Files Affected names an interface file; the same plan as a draft is refused | Build Phase 8 | Build Phase 8 | passing | unit | promise: a-brief-lists-its-looks | apps/indusk-mcp/src/__tests__/brief-looks.test.ts |

### Deferred Verification

- **Starting by talking feels more natural than a form (test plan U1)**
  - reason: a person's experience, not an observable rule
  - would require: using it on real plans
  - mitigation: review cadence — the retrospective of each of the next three plans approved under this rule records, as expectation 2's reading, whether Sandy approved from the brief alone and whether the plan started as a conversation; reviewed by Sandy at the third, in the follow-up plan for this view
- **The agent proposes a name and type that suit the plan (test plan U2)**
  - reason: the quality of a model's proposal cannot be asserted
  - would require: a person reading it
  - mitigation: per-proposal review — a person reviews every proposal on the draft page, and no branch, worktree or folder exists until they press Accept or Edit on the draft page's proposal (A19); a proposal never becomes a plan unseen

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

- **A17** — a live check against the developer's own `claude`, recorded once in Build Phase 5's Verification (moved from Build Phase 4 on 2026-10-13 with Sandy's approval: a plan being built offers no planning session, so the check runs on the conversation entry Build Phase 5 builds).

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
- [x] Discovered: `plans approve` refuses a look its brief names that is not drawn in the worktree, naming it, as it refuses a proposed one; no name is exempt, since a new component is named by its own mockup (ADR decision 4a). Supersedes the "not held" decision on the gate item above (A24)
- [x] Discovered: the planner skill, the brief template and the planning rules template say a story is never named without a mockup: a new component is drawn as its own mockup (`screens/<component>.<state>.html`, declared with `indusk-new-components`) and named in the brief beside the screens that use it

#### Build Phase 2 Verification

- [x] A4, A7, A8 and A9 pass and A6 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/look-ownership.test.ts src/__tests__/plans-approve-looks.test.ts`); the package's looks tests and `plans` tests pass; tsc and biome clean on changed files
  - Result: `pnpm build` clean; `look-ownership.test.ts` (A4, A6, A7 and the overview's plan) and `plans-approve-looks.test.ts` (A8, A9, A23) and `approved-brief.test.ts` pass, 10 tests; `vitest related` over the 5 changed source files ran 21 files, 153 tests, all green (one `release-incident.test.ts` A12 timed out at 5s under the parallel load and passed 6 of 6 alone); tsc clean in `indusk-mcp` and `indusk-admin`; biome clean on changed files.
- [x] A24 passes and A8, A9 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/plans-approve-looks.test.ts src/__tests__/approved-brief.test.ts`); `indusk promises contract brief-as-the-contract` passes; tsc and biome clean on changed files
  - Result: `plans-approve-looks.test.ts` (A8, A9, A23, A24) and `approved-brief.test.ts` pass, 4 tests; `vitest related` over `approved-brief.ts` green; `promises contract` agrees (10 made, 1 changed); tsc clean; biome clean; the installed planner skill and planning rules resynced so `skill-sync-parity` and `workflow-types-parity` pass.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/src/lib/looks/CLAUDE.md`: an approval entry records the plan it was made in; the record stays append-only — guarded by `look-ownership.test.ts` (A4, A7)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `approve` records the brief and refuses a proposed mockup; `apps/docs/src/guide/ui-promises.md`: a look belongs to the plan that made it

### Build Phase 3: An amendment waits for the person

**Tier**: strong — edits `check-gates.js`, the gate every plan's build passes through

- [x] `apps/indusk-mcp/src/lib/plans/amendments.ts`, exported as `./plans/amendments`: `amendmentsOf(plan)` compares the brief's expectations, promises and looks, and each owned promise's statement, to those at `approved_brief` (read with `git show` of the approval commit, as `plans audit-inputs` does) and returns `{part, name, was, now}` per difference; the test plan, ADR, impl, notes and Shape findings are not compared
  - Note: `amendmentsOf(planDir)` takes the plan folder (as `briefStandingOf` does); the comparison itself is the pure `amendmentsBetween(approved, now)`. The approval commit is the newest on the branch whose subject is `plan(<plan>): impl approved`, `plan(<plan>): approved` (a workbench) or `plan(<plan>): amendment approved` (`reapprove`), and its brief must hash to `approved_brief` or the read throws `AmendmentsUnreadable` — never "nothing changed". A registry statement moved to the sentence the approved brief already stated for it (a planned `promises change`) is not an amendment. The exact bytes come from a new `fileAtRevision` in `lib/git.ts` (the `git()` runner trims).
- [x] `hooks/check-gates.js` refuses to check off a build item while `amendmentsOf` is non-empty, naming each amendment and the command that resolves it (`lesson: a-plan-builds-only-after-approval`)
  - Note: the hook runs `indusk plans amendments <plan> --dir <the impl's folder> --json` (new; the rule is the package's, never a second reader in a hook) only when a build-phase item is checked off and the impl records `approved_brief`. An impl without it — every plan approved before the field, this one included — runs no command and behaves as before; a command that cannot run refuses with the could-not-check lesson. The installed copy (`.claude/hooks/check-gates.js`) resynced; the 35 hook-touching test files (244 tests) pass.
- [x] `indusk plans reapprove <name>`: refused before approval; runs the contract check; sets `approved_brief` to the current hash; appends each amendment (what it was, what it is, by, at) to `plan-history/<plan>.md`
  - Note: `lib/plans/reapprove.ts` (`reapprovePlan`, exported from `./plans`). It also runs the looks gate `plans approve` runs (an amendment that names a look waits for that look's approval), commits the impl, the brief and the changed promises on the plan's branch as `plan(<plan>): amendment approved` — the commit `amendmentsOf` reads next — and is a no-op when nothing waits and the brief is the one recorded. History lines read `amendment to the <part> <name>: was <json>, now <json>`, answered "Approve". `plans review` gains `amendments: {approved, waiting, unreadable}` (optional on `Review`, so a review from an older CLI reads as none), which is where A12's "both versions" are shown.
- [x] `apps/indusk-admin/src/app/api/plans/[name]/reapprove/route.ts`: `adminOnly` first, then the same `Sec-Fetch-Site: same-origin` guard the look approval has; calls `reapprove` through the package
  - Note: `{ project }` → `reapprovePlan(root, name)` from `@infinitedusky/indusk-mcp/plans`; a `PlanCommandRefusal` is a 409 naming why. Added to `admin-hosts.test.ts` (A34 imports every route module, so a new one fails it until listed).
- [x] `indusk promises change a-plan-builds-only-after-approval --plan brief-as-the-contract --statement "A plan leaves draft only through indusk plans approve, and no build item is checked off on a plan that is not approved or that has an amendment waiting." --reason "an amendment waits for the person"`
- [x] `plans accept` refuses, naming each, while a new component the brief names (a mockup declaring itself in `indusk-new-components`) has no approved story of the same name, or a mockup the brief names still draws a component inline or composes one not approved (`unapprovedUses`); the message names approving the story on the Looks page and placing it with `<indusk-component>` as the way forward (A25, ADR decision 4a)
  - Note: `storiesWaiting(root, brief)` in `lib/plans/approved-brief.ts`, beside `unapprovedMockups` (the two share one app reader, `readLooksApps`). A mockup is a new component's own when it declares its own screen name in `indusk-new-components` (`badge.ok` declaring `badge`); "draws inline" is any other component it declares new. Every mockup the brief names is held, must-not-break ones included. Not applied to workbench plans, as at approval.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Result: 16 files reviewed (12 code, 4 tests; no extension's rules unreadable); one finding (below), one left as-is. The could-not-check wording `check-gates.js` shares with `validate-impl-structure.js` is cross-file and left to /cleanup.
- [x] Shape (`apps/indusk-mcp/src/lib/plans/amendments.ts`) — read a plan's owned statements through one function (`statementsFrom`) handed where each file is read from, instead of `statementsAt` and `statementsOnDisk` repeating the same loop. Rule: Does this unit have one reason to change? (shape: intra-unit)
- [x] Shape (`apps/indusk-mcp/src/lib/plans/reapprove.ts`) — reviewed, left as-is: `reapprovePlan` is the command's sequence — refuse, check, compare, record, commit, write history — one call per step, each with its refusal; the order is the rule, and a helper per step would hide it

#### Build Phase 3 Verification

- [x] A11, A12, A13 and A25 pass and A14 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/amendments.test.ts src/__tests__/plans-accept-stories.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/amendment-approval.test.ts`); the hooks' tests (`apps/indusk-mcp/hooks`) pass; `indusk promises check` passes; tsc and biome clean on changed files
  - Result: `pnpm build` clean; `amendments.test.ts` (A11 x3, A12, A14) and `plans-accept-stories.test.ts` (A25), 6 tests, pass; `amendment-approval.test.ts` (A13) passes, and `admin-hosts.test.ts` with the new route listed; the 62 hook-touching and parity files pass but for `impl-corpus.test.ts` (A4 of the test-phase plan); `vitest related` over the 12 changed mcp files ran 81 files, 498 tests, and the admin's over its changed files 9 files, 65 tests; tsc clean in both; biome clean on the 15 changed files; `indusk promises check` passes (114 promises), with the installed CLI and the worktree's build.
  - Pre-existing, not this phase's (each fails the same way on 309f1c04, the phase-start commit, run in a scratch worktree): `impl-corpus.test.ts` refuses the archived impls over 64 KB (`ui-promises`, `storybook-components`, …) because `promises contract --impl-stdin` hits `EAGAIN` reading a large stdin pipe under the hook — the same files pass with stdin from a file; `inbox.test.ts` A17 receives an extra `reminder` entry (date-dependent); `plan-worktrees-cli.test.ts` A13 finds an untracked `.mcp.json` in a new worktree. Under the parallel `vitest related` load A12, A25 and `loop.test.ts` T5 timed out at 5 s and each passes alone.

#### Build Phase 3 Context

- [x] guard: `check-gates.js`'s refusal carries `lesson: a-plan-builds-only-after-approval` and its test is `amendments.test.ts` (A12); `apps/indusk-mcp/hooks/CLAUDE.md`: an amendment, not an impl edit, is what stops a build
  - Note: the refusal ends on its own `lesson: a-plan-builds-only-after-approval` line (A12 asserts it); the lesson the refusal names (`.claude/lessons/a-plan-builds-only-after-approval.md`) now says an amendment holds the build too, and that the agent shows it to the person and never reapproves on its own; `hooks/CLAUDE.md` gains the rule with `amendments.test.ts` as its guard. Context-tier and lesson tests (7 files, 52 tests) pass.

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `plans reapprove` and what counts as an amendment; `apps/docs/src/guide/briefs.md`: changing what was agreed during a build
  - Note: the reference also gains `plans amendments` and `accept`'s new-component refusal; the guide's "The question" no longer says a story is named directly (ADR decision 4a), and gains a Mermaid of build → amendment waits → approved → stories → accepted.

### Build Phase 4: The plan page shows the parts of its brief

**Tier**: med — the work step's default

- [x] Draw the mockups for the looks the brief already lists (`plan.parts`, `plan.drafts`, `plan.new`, and the changed `plan.needs-you`, `plan.working`, `plan.released`) on the admin's foundation composed of its components; any component they need that has no story is drawn as its own mockup, one per state, and named in the brief (ADR decision 4a)
  - Note: six screen mockups (`plan.parts`, `plan.drafts`, `plan.new` new; `plan.needs-you`, `plan.working`, `plan.released` redrawn with the three parts) are states of the `plan` screen in `screens.json`. Three new components have no story, so each is drawn as its own mockup per state and named in the brief's Looks: `expectation-row.default` / `.due`, `draft-row.default` / `.aged`, `amendment-card.waiting`; the screens draw them inline under `indusk-new-components`. `look-row`, `rail-group`, `decision-card`, `nav`, `tag` and `button` are placed by name. `indusk looks lint admin` finds no raw value and only the needs-a-story notices; `looks status` lists all eleven proposed (the three redrawn screens held to their approved version).
- [x] **Pause for a person**: Sandy approves this plan's mockups on the Looks page and the amendment on the plan page (Deferred Verification U1)
  - Note: 2026-10-12 — Sandy approved all 11 mockups on the Looks page (`?checkout=brief-as-the-contract`). No amendment to approve: this plan's impl predates `approved_brief`, so `amendmentsOf` has no baseline for it.
- [x] `apps/indusk-mcp/src/lib/plans/parts.ts`, exported as `./plans/parts`: for a plan, its promises (the registry rows it owns), expectations (parsed from the brief) and looks (the brief's list joined to `looks/overview`'s approval, with `plan`); the amendments waiting
  - Note: `readPlanParts(root, plan, folder?)` reads the plan's checkout (its worktree, else the project): promises are the registry rows it owns plus any the brief makes that the registry lacks (`unregistered`), expectations come from `parseBriefContract`, and each look the brief lists (makes, changes, a replacement's new name, must-not-break) is joined by name to `looks/overview`'s mockups and stories for its approval and owning plan, or reads `undrawn`. Amendments come from `amendmentsOf`; an unreadable approval is returned as `amendmentsUnreadable`, never as none.
- [x] `apps/indusk-admin/src/components/plan/PlanParts.tsx`: promises, expectations and looks as three parts with names and states first, each look drawn at the reference devices with the Looks page's frame and proposed until approved there, the brief one link below, and each waiting amendment with Approve calling `plans reapprove`'s route
  - Note: `PlanParts` (server) draws the three parts from `plans/parts`: promise pills with a state dot, `ExpectationRow`s, and `PlanLook`s (the approved `LookRow` with its frame one click on, `LookFrame` at the app's reference devices, "Approve it on the Looks page" linking to the plan's checkout; a look is approved only there). The waiting amendment is `WaitingAmendments` in the page's stage above the decision card, as the approved `plan.needs-you` mockup places it (not inside `PlanParts`), with `ApproveAmendments` posting to `plans/[name]/reapprove`. `/p/<project>/plan/<plan>/brief` is new and shows the brief. Discovered: the mockups declare `expectation-row` and `amendment-card` new, so each is one file in `components/ui/` with a story per state (`ExpectationRow`, `AmendmentCard`); `draft-row` is Build Phase 5's. Their stories are written but not yet rendered or approved: `plans accept` holds the plan until `indusk looks stories admin` renders them and a person approves each (ADR decision 4a). A5 and A15 are authored from their carried bodies in `plan-parts.test.tsx` (node project, `NODE_PAGES`) and pass.
- [x] `buildReview` returns an `evidence` group holding the test plan, ADR and impl, shown on the review with no control to sign them off
  - Note: `Review.evidence` is `{document, path}` for each of `test-plan.md`, `adr.md`, `impl.md` the plan has, in that order, with no field a sign-off could be recorded in; `ReviewPanel` lists them under "You approved the brief. These are read, not signed off." A10 is authored from its carried body in `review-evidence.test.ts` (awaiting `buildReview`, which is async) and passes.
- [x] The page refreshes on the existing `LiveRefresh` so what the agent writes appears; a look file change is read on the next refresh
  - Note: no change to `LiveRefresh`: the page already mounts it, and `readPlanParts` reads the brief, the registry and the mockups from disk on every request, so a refresh shows what the agent wrote. A16 is authored from its carried body in `plan-parts.contract.test.ts` (system tier, listed in `SYSTEM`; the agent's step is one `writeMockup` that draws the mockup and lists it in the brief) and passes in Chromium: the row appears proposed within the refresh, and the frame is 390 and 1440 wide at phone and desktop.
- [x] A story's frame draws in the app's type: `indusk looks stories` writes the app's compiled `body` rules as `components/_base.css` (`baseStylesheet` in `lib/looks/component-styles.ts`), `readApp` reads it as `base`, and `storyDocument` loads it under the component's sheet — found by Sandy at the pause: every story, `expectation-row` most visibly, was drawn in the browser's default serif because the frame carried the tokens and the component's classes but no base rule. Not part of any approval hash, so no approved story reopens
  - Note: `components/_base.css` for the admin holds its `body` rules (ground, ink, `--font-sans`, base size and leading); `expectation-row.default` now computes IBM Plex Sans in the Looks page's frame. Regenerating the stories changed no snapshot and no component sheet, so no approval reopened. Tests: `baseStylesheet` (component-styles.test.ts) and the frame's order (overview.test.ts); `vitest related` over the four changed files, 28 files, passes but for `looks-admin-components.test.ts` A2, which names `draft-row` — drawn in this phase's mockups, built in Build Phase 5, and red until then whatever this item does.
- [x] The plan screens place the approved `expectation-row` and `amendment-card` stories with `<indusk-component>` instead of drawing them inline (ADR decision 4a; A25's refusal at accept), and drop them from `indusk-new-components`; `plan.parts`, `plan.needs-you`, `plan.working` and `plan.released` return to proposed for Sandy's approval. `draft-row` stays inline in `plan.drafts` until Build Phase 5 builds it
- [x] The plan page draws what its approved mockups (`plan.parts`, `plan.needs-you`, `plan.working`, `plan.released`) draw and nothing else: the stage strip, the phases and the document sections `PlanDetail` renders below the parts are removed from the page — found by Sandy at A17 (2026-10-13): "there shouldn't be stuff there that isn't in the mockup". Anything the mockups show that the page lacks is added; tests asserting the removed sections change with them
  - Note: the page no longer renders `PlanDetail`. A new `plan/PlanFrame` draws the crumb, the plan's name and the worktree tag; beneath it the parts with the one link to `/brief`, then the Planning/Release rail beside the amendment card and the decision, building or released card. Removed from the page: the status badge and copy button, type chip, holding badge, dates, Path and promise chips (the Promises part holds them), the plan bar, the stage strip and phase progress lines, the "Read from the worktree" line, "What happened", and the Details block of every document and phase. Kept because they appear only when there is something to say or ask, and no mockup draws them: the copy-problem and trust notices, the malformed banner, Plan/Approve/Build controls, a parent plan's subplan cards. `LiveRefresh`'s "live — refreshes every 5s" is screen-reader-only now. `PlanDetail`, `PlanHeader`, `PlanHistory` and the phase sections keep their own tests and have no page user: a Cleanup phase decides whether they go. Tests changed: `header.test.tsx` (three tests asserted title, dates, Path, promise chips and Details; now the frame's crumb and name, none of those regions, the rail kept) and `decision.test.tsx` (plan-cockpit's A17, which asserted the What happened list; now asserts the page draws none). No trajectory row of this plan changed.
- [x] Draw into the plan mockups what Sandy kept (2026-10-13): the Build control on `plan.working` (Build starts the unattended run of `/work`, falsify and cleanup after approval), and a History panel on the plan's states — collapsed by default, opening to the plan's recorded events (`plan-history/<plan>.md`) with who and when; a component without a story is drawn as its own mockup per state and named in the brief (ADR decision 4a). Going back to an earlier point is not in this plan
  - Note: Build control drawn inline on `plan.working` under the building card (the `button` story is fixed to Approve/Not yet); new component `history-panel` drawn as `history-panel.closed` and `history-panel.open`, closed row on `plan.parts`, `plan.needs-you`, `plan.working`, `plan.released`, open state in the new `plan.history`; all named in the brief's Looks. Proposed, not approved.
- [x] **Pause for a person**: Sandy approves the redrawn mockups and any new component mockups on the Looks page
  - Note: 2026-10-13 — Sandy approved all seven: `history-panel.closed`, `history-panel.open`, `plan.history`, and the redrawn `plan.working`, `plan.parts`, `plan.needs-you`, `plan.released`.
- [x] The page draws the Build control and the History panel as the approved mockups do
  - Note: `ui/HistoryPanel` (a native `<details>`, closed by default, "History · N events", newest first with what, who and when, no restore control) has a story per state (`closed`, `open`) and a test; the page draws it after the stage from `readPlanHistory`, and `BuildControls` stays where `plan.working` draws it. `looks stories admin` rendered the stories; `plan.parts`, `plan.working`, `plan.needs-you`, `plan.released` and `plan.history` now place `history-panel` by name and are proposed again for Sandy, with the story. `PlanHistory.tsx` (components/cockpit) has no importer now; it is left for the Cleanup phase.
- [x] Redraw the plan mockups (`plan.parts`, `plan.needs-you`, `plan.working`, `plan.released`, `plan.history`) to Sandy's layout (2026-10-13): the status first and always open — where the plan stands (planning, building phase N of M, review, released), what waits on the person (the decision, a waiting amendment) and the Build control; under it every other part collapsed by default, each a closed row with its name and a one-line summary — Promises, Expectations, Looks, History — and the brief link. Collapsible parts compose one disclosure component (a new one is drawn per state and named in the brief, ADR decision 4a)
  - Note: the five plan screens now draw the header, then Status (the Planning/Release rails, the decision or amendment card, and on `plan.working` the Build control) always open, then Promises, Expectations, Looks (new `part-section`, closed row = name + one-line summary) and History (`history-panel`) collapsed, then "Read the brief"; `plan.history` has History open. New component `part-section` drawn as `part-section.closed` and `.open` (declared with `indusk-new-components`, drawn inline) and named in the brief's Looks. `looks lint admin`: no raw value, no undefined token; `promises contract` passes. Proposed, not approved.
- [x] Add a Phases part to the plan mockups (Sandy, 2026-10-13: the phase reports the old page's Details section showed, missing from every mockup): collapsed by default between Looks and History, its summary the current phase and items done ("Build Phase 4 of 6 · 38 of 52 done"); open, each phase a collapsed row with its name and state (done, in progress, not started); a phase opened shows its items and the notes recorded under them. `plan.phases` draws the page with Phases and one phase open
  - Note: a Phases part (`part-section`, closed row: "Build Phase 4 of 5 · 38 of 52 done"; "All phases done · 52 of 52 done" on `plan.released`) sits between Looks and History on `plan.parts`, `plan.needs-you`, `plan.working`, `plan.released` and `plan.history`. New `plan.phases` draws it open: Test Phase 1 and Build Phases 1-3 closed and done ✓, Build Phase 4 open and in progress with checked and unchecked items and their notes in smaller muted text, Build Phase 5 not started. New component `phase-row` is drawn as `phase-row.closed` and `phase-row.open`, declared with `indusk-new-components` in `plan.phases` and named in the brief's Looks (items 14-16); `plan.phases` and `phase-row` are registered in `screens.json`. `looks lint admin`: no raw value, no undefined token, story notices only; `promises contract` passes. Screenshots read on the Looks page. Proposed, not approved.
- [x] Add a Documents part to the plan mockups (Sandy, 2026-10-13: the old Details section also held the plan's documents): collapsed by default after Phases, its summary the count; open, each document (research, brief, test plan, ADR, impl, and falsification, cleanup, audit when they exist) a collapsed row with its name and status; a document opened shows its text rendered. The "Read the brief" link is removed — the brief is in Documents. `plan.documents` draws the page with Documents and the brief open
  - Note: Documents part (`part-section`, closed row: "5 documents"; "8 documents" on `plan.released`, which adds Falsification, Cleanup, Audit) added after Phases on `plan.parts`, `plan.needs-you`, `plan.working`, `plan.released`, `plan.history` and `plan.phases`; the "Read the brief" link is gone from all six. Per Sandy's change of direction a document does not open inline: each is a clickable row (name and status) reusing `phase-row.closed`, opening the document's own page, so no prose open state and no new component. `plan.documents` draws Documents open (Research written, Brief accepted, Test plan written, ADR accepted, Impl in progress 38 of 52), declares `phase-row` as `plan.phases` does, is registered in `screens.json` and named as item 17 in the brief's Looks. `looks lint admin`: story notices only; `promises contract` passes. Screenshots read on the Looks page (statuses clip at the stage frame's edge). Proposed, not approved.
- [x] **Pause for a person**: Sandy approves the redrawn plan mockups, the `history-panel` story and any new component's mockups
  - Note: 2026-10-13 — Sandy approved all 13: `plan.parts`, `plan.needs-you`, `plan.working`, `plan.released`, `plan.history`, `plan.phases`, `plan.documents`, `part-section` closed/open, `phase-row` closed/open, and the `history-panel` story closed/open (so History keeps its own component; unifying it with `part-section` is left to /cleanup).
- [x] The page draws the approved layout: status first, every other part collapsed by default
  - Note: status (rail, decision/building/released card, waiting amendment, Build) open; Promises, Expectations, Looks, Phases, Documents (`PartSection`) and History (`HistoryPanel`) collapsed, summaries computed in `lib/plan-parts-view.ts`. Phases reads item notes through a new optional `note` on the package's `ChecklistItem`; each document opens at `/doc/[doc]` (`/brief` redirects). A16's test now opens Looks before it waits — Sandy, 2026-10-13: "Can we move forward?", after A16 under the collapsed layout was put to her with that as the recommendation; the row's assertion is unchanged. Differences from the mockups: phase rows say "Phase 4" (A36 of cleanup-pins forbids `phaseLabel` in the admin); Expectations has no due count (the brief records none). Admin suite 592/593 (A18, Build Phase 5's); A5, A15, A16 pass; tsc and biome clean. The plan screens now place `part-section`, so they and its 15 story states wait for Sandy
- [x] A document opens in place (Sandy, 2026-10-13: "the documents are still links, they should just be collapsed document area"): each row in the Documents part is a disclosure, closed by default, that opens to show the document rendered — not a link, no panel; `plan.documents` redrawn with the brief open, the page to match
  - Note: each Documents row is a `PhaseRow` disclosure, closed by default, opening in place to the document through `Markdown` in a `.doc-scroll` area (`globals.css`, max 60vh); inside each opened row an "Open on its own page" link keeps the `/brief` and `/doc/[doc]` routes reachable, which A15 (a brief href on the page) still asserts and which the rows no longer carry as links, so A15's assertion is unchanged and passes. `part-section.documents-open` shows the Brief row open on this plan's real brief; `plan.documents` already placed it. Admin suite 592/593 (A18, Build Phase 5's); tsc and biome clean on changed files. Changing `part-section`'s story and `globals.css` reopened `plan.documents`, `.history`, `.needs-you`, `.parts`, `.phases`, `.released` and `.working` as proposed — Sandy approved them at 16:53 and they need approving again
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Result: 54 files changed (no extension's rules unreadable); the page, `PlanParts.tsx`, `plan-parts-view.ts`, `PartSection`, `PhaseRow`, `HistoryPanel`, `PlanFrame` and the doc route read as units. Two findings, below; one left as-is. Components the page no longer imports (`PlanDetail`, `PhasesSection`, `cockpit/PlanHistory`, …) and `history-panel` beside `part-section` are cross-file and left to /cleanup.
- [x] Shape (`apps/indusk-admin/src/lib/plan-parts-view.ts`) — the items-done tally was written twice (`phasesSummary`, `planDocuments`); one `tally(phases)`. Rule: Should this inline block have been a named function? (shape: intra-unit)
- [x] Shape (`apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx`) — the comment on `LiveRefresh` sat above the dates read it does not describe; moved to the line it explains. Rule: Does the name say what it is for? (shape: intra-unit)
- [x] Shape (`apps/indusk-admin/src/components/plan/PlanParts.tsx`) — reviewed, left as-is: four exported parts (brief parts, phases, documents, waiting amendments) share one reason to change — what the plan page shows below its status — and each is a short render over data `plan-parts-view` computes

#### Build Phase 4 Verification

- [x] A5, A10 and A15 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/review-evidence.test.ts`); A16 passes in the system tier (`cd apps/indusk-admin && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/plan-parts.contract.test.ts`, listed in `SYSTEM`)
  - Result: `plan-parts.test.tsx` (A15, A5) 2 tests pass in the node project; `review-evidence.test.ts` (A10) 1 test passes; `plan-parts.contract.test.ts` (A16) passes in Chromium in the system tier (listed in `SYSTEM`). Their rows are `passing` (State cells only). Fixing the page for the browser project: `plans/parts` reads node:fs, so the five page tests that render the plan page mock it as a plan with no brief (`readPlanParts(root, plan, {archived})` now computes the folder itself, so `page.tsx` imports no `node:path`).
- [x] The admin's everyday suite passes; `indusk looks check admin` reads every checked look held; tsc and biome clean on changed files
  - Result: admin `pnpm test`: 83 files pass, 570 of 571 tests; the one failure is `NewPlanForm.test.tsx` A18, the row Build Phase 5 passes (state `written`, unchanged). `indusk looks check admin`: 354 held, 0 broken, exit 0 (105 unchecked: the new stories await approval, and the running admin on :3939 is main's build, which does not report the new states); `looks lint admin` finds no raw value and no undefined token, only needs-a-story notices for the inline-declared components; tsc clean in both packages; biome clean on every changed file (the findings it reports elsewhere, `project-reader.ts`, `hook-cwd-independence.test.ts`, public svgs, are not this phase's).

#### Build Phase 4 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a plan's page shows its three parts from `plans/parts` and computes none — guarded by `cockpit-single-definition.test.ts` and `plan-parts.test.tsx` (A15)
  - Note: the rule is in `apps/indusk-admin/CLAUDE.md` beside the cockpit's other single-definition rules; `cockpit-single-definition.test.ts` now lists `plans/parts` and `readPlanParts` as package-only.

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the plan page's parts, the amendment Approve, the review's evidence
  - Note: a new section "The plan page's parts" (promises, expectations, looks, the brief link, the amendment card with Approve, the review's evidence) and the `/brief` route in the routing tree.

### Build Phase 5: A plan starts as a conversation

**Tier**: med — the work step's default

- [x] `apps/indusk-mcp/src/lib/drafts/`, exported as `./drafts`: create, list, read, write the proposal (`{name, type}`), discard and age out drafts under `<project home>/drafts/<id>/`; `drafts.max_age_days` (default 30) in `.indusk/config.json`, swept by `archive-dead`
  - Note: a draft is `<home>/drafts/<id>/` (`draft.json`, then `brief.md` or `research.md` as the conversation writes them, `proposal.json`), the home being `bookkeepingRoots(root).home`, so nothing is in any checkout or branch. `lib/drafts/store.ts` has create, find, list (newest first, with a title, whether it has a brief, and `aged` after 7 days untouched), proposal read and write, discard, `touchDraft` and `sweepDrafts`; `describeDraftAge` words the age as the page shows it ("last talked 2h ago", "untouched 12 days"). `drafts.max_age_days` is read by `getDraftMaxAgeDays` (default 30) and `plans archive-dead` discards drafts past it (`--dry-run` reports). `./drafts` is exported. `drafts-age.test.ts` (3 tests) passes; A20 passes; A19 and A21 wait for `startFromDraft`, the next item.
- [x] `indusk plans start <type> <name> --from-draft <id>`: creates the branch and worktree, writes the draft in as `brief.md` (or `research.md` for `spike`), removes the draft; refuses a name already taken; `plans start` without the flag is unchanged
  - Note: `startFromDraft` (`lib/drafts/start.ts`) reads the draft's proposal and documents and calls `startPlan` with the draft as its first document (new `StartOptions.document`; a body without front matter gets the plan's own, so `workflow:` is set); a draft with no brief becomes a `spike` with `research.md` and no brief; the draft folder is removed on success and kept when the name is taken, the refusal adding "choose another name". The CLI flag takes `type` and `name` as the person's edit over the proposal. `plans start` without the flag is untouched: A19, A21 and the new `drafts-cli.test.ts` (2 tests) pass, A23 still passes.
- [x] The session module runs a draft's conversation with the draft folder as its working directory, so it reads and writes nothing in a checkout; the planning rules it runs under are the planner's
  - Note: `session/draft.ts`: `draftConversation(draft)` gives the session options for a draft — its folder as `cwd`, kind `planning`, no `addDirs`, and a `plan` of `draft:<id>` (`draftSessionPlan`, the one definition the routes and page read) — and copies the planner skill into the folder as `planner.md`, since a folder outside the project has no `/planner`; `draftPrompt` tells the agent to ask for no name or type, write `brief.md` (or `research.md`), propose `proposal.json` when clear, and touch nothing in the project. Exported from `./session`; `draft.test.ts` (3 tests) passes.
- [x] The admin's "New" opens an empty draft and its conversation; the draft page shows the proposal with Accept and Edit; the project page lists drafts with Reopen and Discard
  - Note: "New plan" (`NewPlanForm`, now a button that asks for nothing) posts to `api/drafts`, which opens an empty draft in the project home and moves to `/p/<project>/draft/<id>` (new page, drawn as the approved `plan.new` draws it: crumb, "New plan", the box to tell the agent what you want). `DraftConversation` starts the draft's session through `api/drafts/[id]/talk` (the package's `draftConversation`, so the agent works in the draft folder) and shows `SessionConnector`; the agent's writes refresh the page, which shows the brief's promises, expectations and looks so far (`DraftParts` over `readDraftView`) and `DraftProposal` with Accept and Edit once `proposal.json` exists. Accept posts to `api/drafts/[id]/accept` (stops the draft's conversation, `startFromDraft`, moves to the plan page; a taken name is shown as the refusal words it with the name open); a workbench of several repos is asked which repo here, where workbench-plan-authoring A9 moved (`DraftProposal.test.tsx`). The project page lists drafts (`DraftList`: `DraftRow` Reopen and Discard, `api/drafts/[id]/discard`). `draft-row` is built as one file with stories `default` and `aged`; `plan.drafts` now places it with `<indusk-component>` instead of drawing it, so it is proposed again and `draft-row`'s two stories await Sandy (`indusk looks stories admin` rendered them). Not drawn in any approved mockup: the proposal's Accept/Edit card and the parts under the conversation on the draft page — flagged for Sandy. Admin tests added: `DraftProposal`, `DraftList`, `DraftConversation`; `admin-hosts.test.ts` lists the four new routes.
- [x] Remove `NewPlanForm.tsx` and its route's name-first path; A18's test asserts the entry asks for nothing
  - Note: the name-first route `api/plans` (POST `{project, type, name}` → `startPlan` + session) is deleted, with its entry in `admin-hosts.test.ts`; its job is `api/drafts` and `api/drafts/[id]/accept` now. `NewPlanForm.tsx` keeps its file name because A18's Passes-at (`NewPlanForm.test.tsx`) imports it and a row's path may not change: it is no longer a form — one "New plan" button asking for nothing, no name, type or repo. A18 passes (the entry offers neither a name nor a type); the two workbench-plan-authoring A9 rows that filled the old form moved to `DraftProposal.test.tsx` with their assertions (repo asked with two repos and sent, not asked with one). `newPlanPrompt` in the package has no caller left; left for the Cleanup phase.
- [x] The brief is where a plan is written, the plan page is where it is followed (Sandy, 2026-10-13: "If you're going to work on the brief, you go to the brief. In the brief, I think we want the agent on the right as a column, and then promises, expectation and looks on the left"; "the agent in the plan is there to ask questions to maybe update that to say I need to reopen the brief"): accepting a draft's name lands on `/p/<project>/plan/<name>/brief`, the brief's parts and the brief on the left and the agent with Approve in a column on the right, Approve moving to the plan page; the plan page always exists and opens with the plan's description and a link to its brief, "incomplete" until the brief is accepted, and its agent answers questions and sends a change to what was agreed back to the brief; both agents open by reading with the Read tool and asking, never running the planner unasked
  - Note: the description is a first cut — the brief's opening prose before its first `##` (`briefOpening` in `plans/parts`, with the brief's `status`), to be given its own place later. `PlanSummary` draws it on the plan page; `PlanSession` takes the session's opening (`briefOpening` / `planOpening`) and its button's label. `DraftProposal.test.tsx` A9 now expects the landing on `/brief`. Not redrawn as mockups first: the plan and brief pages' looks will read proposed until Sandy approves them (approve then improve).
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Note: reviewed by hand, since `prepareShapeReview` skips while A17 (a person's live check) is unchecked: one finding, `drafts/store.ts` holding two jobs, fixed (`age.ts`); `DraftProposal.tsx` considered and left as is.
- [x] Shape (`apps/indusk-mcp/src/lib/drafts/store.ts`) — the store held two jobs — keeping drafts and wording how long they have been untouched; the age rule and its words move to `age.ts` so each has one reason to change. Rule: Does it have one reason to change, or is it doing two jobs? (shape: intra-unit)
  - Note: done: `drafts/age.ts` holds `AGED_AFTER_DAYS`, `isAged` and `describeDraftAge`; `store.ts` imports them. Drafts, session and `drafts-age` tests pass, tsc and biome clean.
- [x] Shape (`apps/indusk-admin/src/components/drafts/DraftProposal.tsx`) — reviewed, left as-is: one job — the person's accept or edit of a proposal; the edit fields and the accept call share the one state they read, so splitting them would pass six props between the halves

#### Build Phase 5 Verification

- [x] A17, live check: with the admin running, press New, ask the agent in the draft's conversation to add a promise and draw a look, and see both appear without leaving the page — recorded here with the date and what was seen
  - Result (2026-10-13, Sandy, on this branch's admin at :3940): run on a plan's brief page rather than a draft's — Sandy talked to the planning agent on `demo-scenarios`' brief, which wrote the brief's `description:`, a `## Looks` section and drew `scenario.holding` while the page stayed open. Approved — asked: "Still open: A17 — your live check, or skip it in your words" — user: "okay for now lets approve, we will do another plan to clean up this view". On Sandy's word that session's work was then undone (its uncommitted brief and mockups discarded; its merge of main reverted in `0f24b99e` on `plan/demo-scenarios`). Not seen: a draft's conversation drawing a look — a draft holds no mockups (its looks are names in the brief), left for the follow-on plan that cleans up this view.
  - Note: moved from Build Phase 4 on 2026-10-13 — asked: "A17 can't run on this plan's page while it's being built — move it to Build Phase 5, where the conversation entry is built?" — user: "Yes moved is good"
- [x] A18, A19, A20 and A21 pass and A23 still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/drafts.test.ts src/__tests__/plans-approve-looks.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/session`); the admin's everyday suite and both packages' tests pass; tsc and biome clean on changed files
  - Note: Result: `drafts.test.ts` (A19, A20, A21), `plans-approve-looks.test.ts` (A23) 7 tests pass; `src/components/session` 5 files, 26 tests pass (A18). Admin `pnpm test`: 92 files, 594 tests pass after one fix (plan-cockpit's A36 asserted the old form's type and name, now asserts the New plan button asks for nothing; the page test mock is the drafts module). Package `pnpm test` red, none of it this phase's: `looks-admin-foundation` A9 (`looks lint admin`: `plan.drafts` composes `draft-row`, whose two stories await Sandy's approval); `impl-corpus`, `always-on-cleanup` A29, `registry-leak-scan` A22 (`init-browser-telemetry`, `mcp-config-regenerate`), `plan-worktrees-cli` A13 fail the same way on the phase-start commit or are untouched files; nine more timed out at 5 s under the parallel load and pass alone (`plans-accept-stories`, `plans-next`, `release-bugfix-plan` with `--testTimeout=60000`). `promises-cli` A15 failed on this phase (the removed route was a code site of `a-plan-can-start-from-the-admin`); its links now name `drafts/[id]/accept/route.ts` and `DraftProposal.test.tsx`, and `promises check` and `promises contract` pass. tsc clean in both packages; biome clean on every changed file.

#### Build Phase 5 Context

- [x] `.indusk/current.md`: a plan starts as a draft held in the project's home; the New plan form is gone — and root (Key Decisions): "Brief as the contract: looks in the brief, approval of the brief, an amendment stops the build until a person re-approves, a plan starts as a conversation — see `/decisions/brief-as-the-contract`" — always-on because it is design intent every plan is written under
  - Note: a bullet under "In flight" in `.indusk/current.md` (a draft in the home, aged by archive-dead, New opens a conversation, A17 and the unapproved stories open) and a Key Decisions line in the root `CLAUDE.md` pointing at `/decisions/brief-as-the-contract`, which the Document item below publishes.

#### Build Phase 5 Document

- [x] `apps/docs/src/decisions/brief-as-the-contract.md` published from the ADR; `apps/docs/src/guide/briefs.md` and `reference/cli/plans.md` (`start --from-draft`); sidebar entries; changelog: Added — "The brief is the contract: looks belong to a plan, approval is of the brief, a change to what was agreed waits for the person, the plan page shows promises, expectations and looks, and a plan starts as a conversation."
  - Note: `decisions/brief-as-the-contract.md` from the ADR (the Documentation Plan section left out, links made site-relative) with a sidebar entry beside UI Promises; `guide/briefs.md` gains "Starting a plan: a conversation" with the draft flow diagram; `reference/cli/plans.md` documents `start --from-draft`, the drafts sweep in `archive-dead` and `drafts.max_age_days`; `reference/admin-ui/overview.md` gains the draft route and a Drafts section; the changelog has the Added entry. `pnpm build` in `apps/docs` completes (no dead link).

### Build Phase 6: Falsification — what the brief page and the planning session were made to do on the last day

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against the changes made in Build Phase 5's last item and after it (the brief page, the plan's description, the archive cache, the planning session's permissions). Each row A26–A31 is one hypothesis about what is broken; each item below is the fix if it confirms.

- [x] Planning sessions keep their boundary without asking more: `buildArgs("planning")` runs `acceptEdits`, and a planning session's permission requests are decided in code like a build's — a path inside its own folder (the plan's worktree, or the draft's folder) and a tool given no path are allowed unasked; a path outside is forwarded to the person rather than refused. Replaces `bypassPermissions` (A26). Say so to Sandy before landing: it reverses "set it to dangerously" for writes outside the folder only
  - Note: `buildArgs` runs `acceptEdits` for both kinds; `SessionManager.start` decides a planning session's permission events with `decideBuildPermission` over `[cwd, ...addDirs]` (inside or pathless: `decide` allow, never shown; outside: stored and forwarded to the person as before). So the admin needs no change, but a running admin daemon must restart to load it. A4 in protocol.test.ts rewritten to assert `acceptEdits`; `permissions.test.ts` (A26) passes. To tell Sandy before landing: this reverses "set it to dangerously" for writes outside the folder only.
- [x] `briefOpening` in `plans/parts` reads the brief's frontmatter through the package's frontmatter parser (`parseFrontmatter`, gray-matter), not a line regex (A27)
  - Note: reads through `parseFrontmatter` (gray-matter, the promise modules' one reader); a malformed block reads as no description and no status. `plan-parts-description.test.ts` (A27, 3 tests) passes.
- [x] `PlanSummary` takes whether the brief is finished from the package's `documentFinished("brief", status)` (`plans/steps`), shows nothing for a `superseded` brief, and the plan page passes no call to work on the brief for an archived plan (A28)
  - Note: `PlanSummary` calls `documentFinished("brief", status)`, shows a quiet link for a `superseded` brief and for `archived` (new prop; the page passes `plan.archived || archivedInWorktree`). `PlanSummary.test.tsx` (A28, 5 tests) passes.
- [x] The archive cache in `planning-reader.ts` keys on each archived plan's files' mtimes, not only the folders', so an in-place edit reads afresh (A29)
  - Note: the key is the archive's mtime plus, per archived plan, the newest mtime of its folder and the files (and subfolders' files) in it (`newestMtime`). `planning-reader.archive-cache.test.ts` (A29) passes.
- [x] `DraftProposal`'s accept lands on `/brief` only when the plan has a brief; a `spike` lands on the plan's page (A30)
  - Note: the accept route now returns the started plan's `type` (a draft with no brief becomes a spike whatever was proposed); `DraftProposal` moves to the plan page for a `spike`, to `/brief` otherwise. A30 passes, A9 still passes.
- [x] `WindowColumn` fits its height only while the two-column layout applies (the same breakpoint as `.cols-brief-page`), and clears it otherwise (A31)
  - Note: fits only while `matchMedia("(min-width: 760px)")` matches (the `.cols-brief-page` breakpoint), clears `style.height` otherwise and on the media query's change. `WindowColumn.test.tsx` (A31) passes.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Note: reviewed by hand: `manager.ts` routes one more event kind through the decision it already imports (one reason to change, kept); `newestMtime` is a named helper with its seam in the A29 test; `buildArgs` keeps its `kind` parameter (now unused, `_kind`) because `start.ts` and the pinned tests call it that way — left as is.

#### Build Phase 6 Verification

- [x] A26–A31 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session src/__tests__/plan-parts-description.test.ts`; `cd apps/indusk-admin && pnpm exec vitest run src/components/plan/PlanSummary.test.tsx src/lib/planning-reader.archive-cache.test.ts src/components/drafts/DraftProposal.test.tsx src/components/session/WindowColumn.test.tsx`); `vitest related` on the changed files in both packages; tsc and biome clean on changed files
  - Note: Result (2026-10-13): package `src/lib/session` + `plan-parts-description` 8 files, 54 tests pass; admin four files, 13 tests pass. `vitest related` on changed files: package 12 files, 67 tests; admin 21 files, 146 tests, all pass. tsc clean in both packages; biome clean on every changed file (the admin tree has older failures in untouched `project-reader.ts`, `http-promise-remote.test.ts`, `LiveRefresh.tsx`).

#### Build Phase 6 Context

- [x] `apps/indusk-admin/CLAUDE.md`: whether a plan's document is finished comes from `plans/steps`' `documentFinished`, never a status compared in the admin — guarded by `PlanSummary.test.tsx` (A28)
  - Note: added to the admin CLAUDE.md as a rule with its guard (`PlanSummary.test.tsx`, A28).

#### Build Phase 6 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the brief page — the brief's parts and the brief beside the agent's column, the agent following what it writes, the plan's description and the brief's state on the plan page, and what a planning session asks (only for a write outside its folder)
  - Note: new "The brief page" section before "The nav": the two-column layout and phone fallback, the agent following what it writes, the description and the brief's state on the plan page (spike lands on the plan page), and what a planning session asks.

### Build Phase 7: Cleanup — what the plan page stopped using, and the three routes that find a plan

**Tier**: med — the work step's default

**Goal**: decompose what this plan left behind across files: a plan-page component tree no page renders since Build Phase 4, a prompt builder no caller uses since Build Phase 5, three routes that each find their plan the same way (the rule of three), and two exported `briefOpening`s in different packages that mean different things. Each item is one extraction or removal, or a reasoned leave-as-is.

- [x] Remove the plan-page tree no route renders since Build Phase 4 took the page to its mockups: `PlanDetail.tsx` (and its five tests), `plan/PlanHeader.tsx`, `cockpit/PlanHistory.tsx`, `PhasesSection.tsx`, `CleanupSection.tsx`, `FalsificationSection.tsx`, `phases/RitualPhaseSection.tsx` and their tests and stories (≈1,000 lines; nothing outside the tree imports them). `PlanDetail.skipped-rituals.test.tsx` carries `promise: a-review-shows-its-evidence`: before deleting it, confirm what it asserts is held by a test of what the page and the review show now, or move the assertion there, so the promise keeps a test — react: no component kept for no caller
  - Note: removed 3,065 lines (admin): `PlanDetail.tsx` and its five tests, `plan/PlanHeader.tsx`, `cockpit/PlanHistory.tsx`, `PhasesSection`, `CleanupSection`, `FalsificationSection`, `phases/RitualPhaseSection` with their tests; no story existed for any. Importers outside the tree: none (only comments). Two edits followed: `cleanup-pins.test.ts` read `plan/PlanHeader.tsx` to pin HoldingBadge's import, so its list is now `PlanList.tsx` alone; two promises listed a deleted file as a code site (`decisions-wait-in-one-place`: `PlanHistory.tsx` dropped; `a-review-shows-its-evidence`: `PlanDetail.skipped-rituals.test.tsx` replaced by `DecisionCard.tsx`, which carries the token). `PlanDetail.skipped-rituals.test.tsx` was a *site*, not one of the promise's `tests:`, and no trajectory row of any plan names it in a Test cell (admin-plan-authoring's A16 names `plans-review.test.ts`); the promise's tests, `plans-review.test.ts` and `ReviewPanel.test.tsx`, carry the token and stay. What it asserted, a skipped ritual's reason shown on the plan page, is a region Build Phase 4 removed from the page, so there was nothing live to move it to. `indusk promises check` passes.
- [x] Extract `readPlanPage(project, name)` into `apps/indusk-admin/src/lib/plan-page.ts` — the registry lookup, the stale-path return, the active-over-archived find and `notFound()` that `plan/[name]/page.tsx`, `plan/[name]/brief/page.tsx` and `plan/[name]/doc/[doc]/page.tsx` each repeat — and use it in all three (A32) — the rule of three
  - Note: `lib/plan-page.ts` (`readPlanPage` returns `{projectPath, plan}`, `null` for a gone project, `notFound()` for no plan) used by the three routes (−35, +10 lines in them). The plan page still reads both lists inside the parent-plan branch, where it needs them for subplan names. A32 passes; its test imports the module statically now it exists.
- [x] Rename `PlanSession`'s session-prompt builders `briefOpening` / `planOpening` to `briefSessionOpening` / `planSessionOpening`: `plans/parts` exports a `briefOpening` that reads the brief's frontmatter, and two exports of one name with two meanings across the packages read as one — a name says what it is for
  - Note: both builders and their two call sites renamed (`PlanSession.tsx`, the plan page); `plans/parts`'s `briefOpening` is untouched. No test named the admin's builders. tsc clean.
- [x] Remove `newPlanPrompt` (`apps/indusk-mcp/src/lib/session/new-plan-prompt.ts`, its test and its export from `session/index.ts`): the name-first route that used it was deleted in Build Phase 5 and nothing calls it
  - Note: removed `new-plan-prompt.ts`, its test and the export (no other reference in the repo); tsc and biome clean.
- [x] (reviewed `apps/indusk-mcp/hooks/check-gates.js`, +75 — left as-is: the amendment refusal is the hook's own decision and its logic already lives in the package's `plans/amendments`, run through `indusk plans amendments`; hooks are self-contained scripts by convention)
- [x] (reviewed `apps/indusk-admin/src/lib/planning-reader.ts`, +65 — left as-is: the archive cache is the reader's own concern, beside the read it caches)
- [x] (reviewed `apps/indusk-mcp/src/lib/promises/brief-contract.ts`, +80, and `contract.ts`, +36 — left as-is: the Looks section is part of the brief's contract, parsed where the rest of it is)
- [x] (reviewed `cli.ts` +27, `config.ts` +13, `looks/approve.ts` +19, `looks/stories.ts` +7 — left as-is: small additions inside each file's existing job)
- [x] (reviewed `apps/indusk-admin/src/components/session/NewPlanForm.tsx` — left as-is under its name, though it is now a button: A18's Test cell names its test file, and the trajectory's cells are not renamed at close)

- [x] Shape — reviewed the 7 files this phase changed (`plan-page.ts` and its test, the three routes, `PlanSession` rename, `cleanup-pins.test.ts`, `session/index.ts`); one finding: the plan page's header comment still described the lookup and stale-path handling it no longer does — rewritten to point at `readPlanPage`. `readPlanPage` has one reason to change, a name that says what it serves, and a seam a test reaches through its two inputs. The plan page's parent-plan branch reads both plan lists again for its subplan names; left, as it is the only caller needing the lists and only for parent plans.

#### Build Phase 7 Verification

- [x] A32 passes (`cd apps/indusk-admin && pnpm exec vitest run src/lib/plan-page.test.ts`); the admin's everyday suite passes with the removed tree gone (`cd apps/indusk-admin && pnpm test`); `vitest related` on the changed indusk-mcp files; `indusk promises confirm` still finds a test for `a-review-shows-its-evidence`; tsc and biome clean on changed files
  - Note: A32 passes (1 test). Admin `pnpm test`: 88 files, 556 tests, all pass (the removed tree took 5 + 4 test files with it; the prior 592/593's one failure, A18, is Build Phase 5's and passes). `vitest related` on the changed indusk-mcp file `session/index.ts` finds no test file; `tsc --noEmit` clean in both packages; `biome check` clean on every changed file (the admin tree has 4 existing findings in files this phase did not touch: `project-reader.ts`, `http-promise-remote.test.ts`, `LiveRefresh.tsx` x2). `indusk promises check` passes; `a-review-shows-its-evidence` keeps `plans-review.test.ts`, `ReviewPanel.test.tsx` and `DecisionCard.test.tsx`, each carrying its token.

#### Build Phase 7 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a plan route finds its plan through `lib/plan-page`'s `readPlanPage`, never its own lookup — guarded by `plan-page.test.ts` (A32)
  - Note: bullet added after the `planActions` rule; the `One home per piece` entry no longer names a ritual section in `components/phases/` (removed in item 1).

#### Build Phase 7 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: no section still describes the plan page's removed regions (the stage strip, the phase sections, What happened); the routing tree names the brief page and the document page as they are
  - Note: the plan-detail section now describes the frame, the status rails and the six closed parts (Promises, Expectations, Looks, Phases, Documents, History) and says nothing is drawn beyond the mockups; the three progress lines, the type-chip/absence tables, the sections table and the falsification-rendering paragraph are gone; the routing tree gains `/doc/{doc}` and the brief page's real description; the organisation tree and `component-conventions.md` no longer name `PlanDetail` or `RitualPhaseSection`, and a worktree row no longer promises a 'Read from the worktree' line (the page removed it in Build Phase 4).

### Build Phase 8: Audit fixes — holes the cold reader found in four promises

**Tier**: med — the work step's default

**Goal**: close audit findings 1–4 (`audit.md`), which Sandy chose to fix before landing ("fix the one through four short extra phase"): workbench plans skipping the looks checks, the approval-time interface check dropping rows, two ways around the amendment gate, and drafts losing work. Each row A33–A36 is one finding.

- [x] Workbench plans run the looks checks (A33): `approve.ts` runs `refuseUnapprovedLooks` (and the Files Affected interface check) before handing a workbench plan to `approveWorkbenchPlan`; `reapprove` runs the looks check for a workbench plan; `accept.ts` runs the diff interface check and the new-component story check before its workbench return — against the workbench's code repo for the diff, the root's mockups for the looks
  - Note: `approveWorkbenchPlan` already ran the Files Affected check (it is inside `checkPlanContract`, given the root); it now also refuses a still-proposed look. `refuseUnapprovedLooks` takes `(plan, root, brief)`; `reapprove` drops its `if (!wp)`; `accept` passes both modes a `LooksWhere` (folder, mockups checkout, trunk, branch). A33 passes in both test files, `plans-workbench` and `amendments` unchanged green.
- [x] The Files Affected path cell is read path by path (A34): `promises/interface-files.ts` takes every backticked or bare path in the first cell — a path followed by a note in parentheses, two paths separated by a comma or "and" — instead of the whole cell as one path
  - Note: new `pathsInCell`: every backticked span, else each piece split on comma, `&` or "and" with a parenthesised note dropped; a piece with a space left is prose and skipped, as before. A bulleted `- \`a.ts\` — note` now yields its path too (it was dropped whole). The only caller is `contract.ts`'s look check.
- [x] The amendment gate cannot be skipped from the impl (A35): in `hooks/check-gates.js`, the amendment refusal runs before the `<!-- skip-gates -->` escape; and an edit to an approved plan's impl that removes or changes `approved_brief:` is refused, naming `indusk plans reapprove` as the way the field changes. Copy to `.claude/hooks/check-gates.js` as the hooks are installed
  - Note: both checks sit ahead of the escape; the marker path now runs the amendment check only when the edit checks a build item off (the newly-checked walk became `newlyCheckedIn`, shared by both paths). The `approved_brief` guard compares the value on disk with the value after the edit, so `plans approve`/`reapprove` (fs writes, no hook) and ordinary checkoffs are untouched. A35 (both cases), `amendments.test.ts` and 21 hook/gate test files pass; the `.claude/hooks` copy is identical.
- [x] Drafts lose nothing (A36): the age sweep in `drafts/store.ts` moves an aged draft to `<home>/drafts/archive/<id>/` (as ADR decision 9 says, "archives"), and `drafts/start.ts` writes a draft's `research.md` into the plan beside its `brief.md` when it has both
  - Note: `sweepDrafts` renames the folder into `draftsArchiveDir` (not a draft: no marker, so `listDrafts` skips it); `plans archive-dead` now says "Archived". `startPlan` gained `research?`, written and committed beside the first document in both normal and workbench modes; `startFromDraft` passes it for non-spike types (a spike's document is already the research). An explicit discard still deletes. A36 passes in `drafts.test.ts` and `drafts-age.test.ts`.
- [x] The Looks rule is held at approval, not after it (A37) — found at the retrospective: once A34 read cells path by path, `promises check` refused `cockpit-audit-fixes`, approved before this rule, which would have failed `pnpm test` on main. `lookRefusals` in `promises/contract.ts` skips a plan whose impl is approved or later
  - Note: only the sweep over every plan (`checkAllContracts`, what `promises check` runs) skips it — `looksAtApprovalOnly`; asking about one plan by name, as `plans approve` and `reapprove` do, still applies the rule. A37 red on its own assertion first (the approved plan was refused), then passing; `brief-looks.test.ts` 8/8, `vitest related contract.ts` 60/60, `indusk promises check` on this branch passes (114 promises).
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape finding: `plans/accept.ts` — the two looks checks still name their parameter `pb`, a `PlanBranch`, though they now take a `LooksWhere` that a workbench plan fills too; rename it `where` so the name says what it is (rule: name says what it is for, not what it was)
  - Note: renamed in `refuseUnlistedInterfaceChanges` and `refuseStoriesWaiting`; accept tests green.
- [x] Shape (`hooks/check-gates.js`, `lib/plans/start.ts`, `lib/drafts/*`, `interface-files.ts`) — reviewed, left as-is: the hook's two new guards are one concern (the amendment gate cannot be switched off from the impl) and share `newlyCheckedIn`/`isBuildItem` with the checkoff path rather than restating the walk; `pathsInCell` is a named seam of its own; `sweepDrafts` and `startPlan` each keep one reason to change

#### Build Phase 8 Verification

- [x] A33–A36 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/plans-approve-looks.test.ts src/__tests__/plans-accept-stories.test.ts src/__tests__/brief-looks.test.ts src/__tests__/check-gates-amendments.test.ts src/__tests__/drafts.test.ts src/__tests__/drafts-age.test.ts`); `vitest related` on the changed files; the hook copies match (`diff apps/indusk-mcp/hooks/check-gates.js .claude/hooks/check-gates.js`); tsc and biome clean on changed files
  - Note: the six named files pass (6 files, 24 tests); build, tsc and biome clean on every changed file; hook copies identical. `vitest related` on the changed sources: 786 pass, 4 fail, none of this phase's: `always-on-cleanup` A29 (counts two trailing-slash strips in `interface-files.ts` — two at the phase-start commit as well), `plan-worktrees-cli` A13 (named in Build Phase 5's note), and two `inbox.test.ts` A17 cases (the recorded-break inbox; untouched here, extra entries present).

#### Build Phase 8 Context

- [x] `apps/indusk-mcp/hooks/CLAUDE.md`: the amendment refusal runs before any skip marker, and `approved_brief` changes only through `plans reapprove` — guarded by `check-gates-amendments.test.ts` (A35)
  - Note: added to the existing amendment bullet, which now names A35's test beside A11, A12 and A14.

#### Build Phase 8 Document

- [x] `apps/docs/src/reference/cli/plans.md`: `approve`, `reapprove` and `accept` check looks for workbench plans too; `apps/docs/src/guide/briefs.md`: a Files Affected cell may hold a path with a note, or several paths; a draft past its age is archived in the home, not deleted

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
- A story is never named in a brief without a mockup (ADR decision 4a, 2026-10-12): a new component is drawn as its own mockup and approved before the plan; its story is approved against it during the build, and `plans accept` holds the plan until it is.
