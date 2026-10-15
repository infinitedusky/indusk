# Brief as the contract — looks in the brief, approval of the brief, a plan that starts as a conversation

**Decided 2026-10-12.** Full ADR: `.indusk/planning/brief-as-the-contract/adr.md`.


## Goal

**A person works on one document, the brief — promises, expectations and looks — approves it once, and everything after it is the AI's job to make true.**

Today a mockup is drawn outside the plan and approved on another page, `plans approve` signs off four documents at once and refuses a second approval, and a change to what was agreed during a build is recorded nowhere that stops the build. A plan also starts from a form that asks for a name before anyone has said what the plan is.

## Y-Statement

**In the context of:**
a planning system where the person's input is a conversation and the plan's promises come out of it, and where looks (mockups and stories) are already approved by a person in the cockpit and held by value in the running app,

**Facing:**
looks that belong to no plan, an approval that covers documents the person never wrote, a build that can drift from what was approved without anything stopping it, and a start-a-plan form that asks for a name before the plan exists,

**We decided for:**
a brief with a third part, Looks, shaped like Promises and owned by its plan through the approval record; an approval recorded against the brief's hash, with the test plan, ADR and impl shown at review as evidence; an amendment, detected as the brief's difference from what was approved, that stops the build until a person re-approves it; a plan page that shows the three parts with the agent beside them; and a plan that starts as a draft held outside the repository, named once the conversation has made its promises clear,

**And against:**
a promise file per look, a new promise kind for looks, re-running `plans approve` for an amendment, inferring from words whether a plan touches the interface, a scratch folder inside the repository, and renaming a plan mid-conversation,

**To achieve:**
a contract the person can read in one place, a build that cannot quietly leave it, and a way to start that asks for nothing until there is something to name,

**Accepting:**
that the brief must be good enough to carry the whole contract, that a new component is drawn twice (as its own mockup before the build, as its story during it), and that an amendment run from the terminal is the person's by convention, as `plans approve` already is,

**Because:**
each rule reuses something that already holds — the approval record is append-only and already keeps the old version, the brief already has a shape a program reads, `check-gates` already stops a build item on a plan that is not approved — so the change is to what they are asked, not new machinery.

## Context

The contract is the plan's brief, the assertions its test plan. This ADR settles the four questions the plan's research left open.

## Decision

1. **A brief's Looks section has the Promises section's shape.** `## Looks`
   with `### This plan makes`, `### Existing looks` (**Must not break**,
   **Changes**, **Replaces**) and `None — {reason}`; each entry a mockup's name
   — a screen (`plan.working`) or a new component drawn on its own
   (`chip.waiting`), never a story without a mockup (decision 4a). It follows `## Promises` in the
   template; `parseBriefContract` returns it as `looks`. A brief with no such
   section stays valid (A22): the section is required only by decision 2.

2. **Enforcement is at two moments, over two things the plan declares.** At
   `plans approve`, the plan's branch holds only documents, so the check reads
   the impl's `## Files Affected` table: a path under an app's declared
   interface — the `sources` of each `.indusk/mockups/<app>/screens.json`, the
   same paths the look check already trusts — with a brief that lists no look
   and gives no reason is refused, naming the paths and what is missing. At
   `plans accept` the check runs again over the branch's real diff against the
   same sources: a plan that changed those files while its brief says `None`
   is refused, naming them, and the fix is an amendment (decision 5). The
   first catches the plan that says what it will change; the second catches
   the one that changed more than it said.

3. **Ownership is a field on the approval entry.** `ApprovalEntry` and
   `StoryApprovalEntry` gain an optional `plan`, set by the approval from the
   checkout it was made in (`checkout` is already sent by the page). No look
   file, no registry. The record is append-only, so a redrawn look's old
   version stays beside the new one and the app is held to the `reference`
   entry until a person approves the new (`Approval.state: proposed` already
   carries `reference`); that is the history `a-changed-look-keeps-its-history`
   asks for, and the plan's brief says which look it changes.

4. **`plans approve` records the brief and checks the mockups.** It writes
   `approved_brief: <sha256 of brief.md>` with `approved_by` and `approved_at`
   to the impl's frontmatter (beside the `status: approved` it sets), and
   refuses, naming the look, when a **mockup** its brief makes, changes or
   replaces is not drawn, or not approved, in that worktree's record. No look
   is exempt: a new component is named by its own mockup (decision 4a), which
   can be approved before the component exists. The review (`buildReview`)
   shows the test plan, ADR and impl as evidence beside the approval, with no
   control to sign them off.

4a. **A story is never named without a mockup.** A story's snapshot is
   rendered from the real component, so it cannot be approved before the
   build. A new component is therefore drawn as its own mockup,
   `screens/<component>.<state>.html` declaring itself with `<meta
   name="indusk-new-components">`, one per state, and the brief names it
   beside the screen mockups that use it; those screens draw it inline under
   the same declaration until its story exists. The mockup is approved before
   the plan; the story, the same name built, is approved against it during
   the build. `plans accept` refuses a plan while a new component its brief
   names has no approved story, or a mockup its brief names still draws a
   component inline or composes one not approved, naming each
   (`a-new-component-ends-its-plan-with-a-story`). Decided 2026-10-12 in
   Build Phase 2, when the gate as first built let an undrawn name through.

5. **An amendment is the brief's difference from what was approved.** A pure
   function, `amendmentsOf(plan)`, compares the brief's three parts and each
   promise's statement to those at `approved_brief` (read with `git show` of
   the approval commit, as `plans audit-inputs` already does) and lists each
   difference as `{part, name, was, now}`. Edits to the test plan, ADR, impl,
   notes and Shape findings are not amendments (A14). While it is non-empty
   `check-gates.js` refuses to check off a build item, naming the amendments
   (the change to `a-plan-builds-only-after-approval`), and the plan page lists
   them as waiting on the person.

6. **Re-approval is `indusk plans reapprove <name>`, not `plans approve`.**
   `approve` refuses a branch past approval, which is right for it. `reapprove`
   is allowed only after approval, runs the contract check, sets
   `approved_brief` to the current hash, and appends each amendment to the
   plan's history (`plan-history/<plan>.md`, the same record the decision card
   writes). The cockpit's button calls a route with the same browser-only guard
   the look approval has (`Sec-Fetch-Site: same-origin`), so a script or an
   agent's request is refused (A13). Run from a terminal it is the person's by
   convention, as `plans approve` is: the planner runs it on the person's say-so
   and never otherwise.

7. **The plan page's parts are one package module.** `plans/parts` returns,
   for a plan, its promises (the registry rows it owns), its expectations
   (parsed from the brief) and its looks (the brief's list joined to
   `looks/overview`'s approval state). The page renders it; nothing in the
   admin computes a part (the single-definition pin the cockpit already has).
   Looks are drawn with the frame the Looks page uses, at the reference
   devices, proposed until approved there. The planning session panel is
   unchanged; the page is live (`LiveRefresh`) so what the agent writes appears.
   The brief is one link down.

8. **A draft is a folder in the project's home.** `<project home>/drafts/<id>/`
   holds `brief.md` (or `research.md`), the session's own state and
   `proposal.json` (`{name, type}`) the agent writes when the topic is clear.
   The session runs with that folder as its working directory, so it reads and
   writes nothing in a checkout. The page shows the proposal with Accept and
   Edit; accepting runs `indusk plans start <type> <name> --from-draft <id>`,
   which creates the branch and worktree, writes the draft in as the plan's
   `brief.md` (or `research.md`, for `spike`), removes the draft and opens the
   plan. `plans start` without `--from-draft` is unchanged (A23).

9. **A draft that is not kept ages out.** The existing dead-draft sweep
   (`archive-dead`, indusk-makeover) archives a draft untouched for 30 days
   (`drafts.max_age_days` in `.indusk/config.json`, default 30). The page lists
   drafts with Reopen and Discard.

10. **The New plan form is removed.** "New" opens an empty draft and its
    conversation. A name is asked for nowhere before the proposal.

## Alternatives Considered

### A promise file per look, or a promise kind for looks
Rejected, as the ui-promises ADR rejected it. A look breaks by value; a promise
by a violated claim. The brief names a look and the approval entry carries its
plan, which gives ownership without a second registry.

### Re-running `plans approve` for an amendment
Rejected. `approve` merges to the trunk and refuses a branch with code on it;
loosening that would let unreviewed code merge on a re-approval. A separate
command with a narrower job keeps `approve`'s refusal intact.

### Detecting that a plan touches the interface by reading its words
Rejected. It misses by construction, and the miss is silent. Declaring it, then
checking the diff against declared source paths at acceptance, fails loudly.

### A scratch folder inside the repository, ignored
Rejected. An ignored folder is still in a checkout, so it appears in every
worktree and can be committed by a stray `git add -f`; machine state in the
project's home is already where bookkeeping lives (bookkeeping-lives-where-it-is-read).

### Naming the plan first and renaming it
Rejected. A plan's name is its branch, worktree, folder and registry entry; a
rename under a running session moves all four. Naming at the end, from a draft,
needs none of that.

## Consequences

### Positive
- One document to read and approve; the rest is evidence.
- A build cannot leave what was approved without stopping.
- Starting a plan asks for nothing first, and an idea that goes nowhere leaves
  nothing in the repository.

### Negative
- Approval reads the impl's `Files Affected`, which is a plan's own
  statement; a plan that writes none, or the wrong ones, passes the first
  check and is caught by the second, at acceptance.
- A new component is drawn twice: as its mockup before approval, as its story
  during the build.
- `reapprove` from a terminal trusts the person at the keyboard, like `approve`.

### Risks
- A thin brief carries a thin contract. Mitigation: the Looks section and the
  UI-plan question make "nothing visual" a statement with a reason, but cannot
  tell that a promise was left out; that remains the person's judgement.
- A wrong declared interface path hides a UI change from the acceptance check.
  Mitigation: the paths are the `sources` the look check already trusts, one
  definition.

## As built

Three things differ from the decisions above, each decided while the plan was used:

- **The brief has its own page** (decision 7). The brief's parts and the brief sit on `/plan/{name}/brief` beside the planning agent, which follows what it writes; the plan page is where the plan is followed, opening with the brief's `description:` and the brief's state. See [the brief page](/reference/admin-ui/overview#the-brief-page).
- **A planning session asks only to leave its folder.** It runs in `acceptEdits`; a write inside the plan's worktree or the draft's folder is allowed unasked, and only a path outside reaches the person. Before, it asked for every write.
- **A draft's looks are names, not drawings** (decision 8). A draft lives outside the repository and mockups live in it, so a look is drawn on the brief page once the plan exists. A draft past its age is moved to the home's draft archive, as decision 9 says, and accepting a draft keeps both its brief and its research.

The approval and acceptance checks for looks run for workbench plans too, and an amendment cannot be skipped by a `skip-gates` marker or by removing `approved_brief:` from the impl.

## References
- Full ADR: `.indusk/planning/archive/brief-as-the-contract/adr.md`
- [UI promises](/decisions/ui-promises) — the rejected promise per look
- [Storybook components](/decisions/storybook-components) — a story is a look
- [Admin plan authoring](/decisions/admin-plan-authoring) — D3 plan commands, D8 written on its own branch
- [The brief](/guide/briefs), [`indusk plans`](/reference/cli/plans)
