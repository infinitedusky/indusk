---
plan: approval-waits-for-the-planning-run
audited: 2026-10-19
model: claude-opus-5-5
---

# Audit — approval-waits-for-the-planning-run

## Does each row prove its promise's sentence, or something narrower?
- `.indusk/planning/approval-waits-for-the-planning-run/impl.md:74` — A16, the live-check row asserting that on the installed admin no Approve shows anywhere through a whole planning run until `plan-review.md` is answered, is `skipped`, and it is the only row that tests `approval-waits-for-a-finished-plan` as the brief words it ("offered for approval" across every page, through a real run). The unit rows A1–A15 each prove one piece fed by hand (the rule from facts, the reader on a folder, the page source containing a substring); none joins a real run's step gaps to what a rendered page draws.
  - breaks when: a real run has a moment the unit fakes do not model (e.g. the planning state is set after the first `await` in a different order than `decisions-reader.planning.test.ts` drives, or a step's session ends before `planningState` flips), and a page reload in that moment draws Approve — no passing row would have caught it.
  - answer: nothing — A16 is a deferred live check with its reason, requirement and mitigation in the impl; it runs after landing (`pnpm install:local`) and its result goes in Notes. This unattended run was told not to act on findings, and no telemetry mark exists (`otel.role: library`).
- `apps/indusk-admin/src/lib/plan-actions-pages.test.ts:24` — A15, the row asserting that the plan page and the brief page both pass the package's waiting answer into what the page offers, is a text match: it proves each page's source contains `readWaiting(` and that the `planActions({...})` call contains `waitingOn: waiting?.on`. It does not prove the Approve each page renders is drawn from `actions.canApprove` alone.
  - breaks when: a page's render passes `canApprove={actions.canApprove || <its own condition>}`, or the `waiting` variable passed is read for a different plan or set of plans; A15 still passes while the page offers Approve on its own rule.
  - answer: nothing — the plan page's extra `&& waiting?.on !== "approval"` can only narrow the offer, never widen it; a render-level test would cost a browser test in a project whose browser tests already fail for render timing (impl Notes).
- `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts:103` — A11, the row asserting that the plan review is read by the package alone, checks only that the admin and editor do not define functions named `readPlanReview` or `planReviewState`. A second reading under another name (an `existsSync(join(dir, "plan-review.md"))` check, or a direct `readAuditAnswers` call with `PLAN_REVIEW_QUESTIONS`) passes it.
  - breaks when: an admin or editor file decides "review answered" by its own parsing under any other identifier; the run and the offer then disagree and A11 stays green.
  - answer: nothing — A11 follows the name-based single-definition pattern every other cockpit fact uses (`cockpit-single-definition.test.ts`); a parse under a new name is the same exposure every guarded fact has.
- `apps/indusk-mcp/src/lib/plans/waiting.test.ts:274` — A4, the row asserting that a run stopped short of approval lists the plan as needing its plan review with the reason in the decision, is exercised only with a `cannot-continue` stop. The `wait-for-looks` branch of the reason (`waiting.ts:252`) and a stop of `ready-for-approval` on a review the admin now reads as unanswered (reason dropped) are untested.
  - breaks when: a run stops on `wait-for-looks` and the card's wording is wrong or throws on `stop.looks`, or a run stops `ready-for-approval` and the review is later edited to unanswered — the card then gives no reason, and A4 passes either way.
  - answer: nothing — real gap, small: the `wait-for-looks` wording in `waiting.ts` has no case. Left for /falsify to hypothesise (a case on `stop.looks`), since this unattended run was told not to act on findings.

## What does the diff change that no row touches?
- `apps/indusk-admin/src/lib/build-host.ts:427` — a planning run's stop is stored in the admin's in-memory map and never cleared after the run ends; `planReview` (`waiting.ts:247`) now appends that stored reason ("Its planning run stopped: …") to every later plan-review card for the plan. No row covers a stop that is older than the plan's current state.
  - breaks when: a run stops with `cannot-continue: the last step's session failed: exit 1`, the person or a planning conversation then fixes that and rewrites the impl by hand, and the review is still unwritten — the card keeps naming the old failure as why the run stopped until the admin restarts.
  - answer: nothing — the stop is replaced when the next run starts (`startPlanning` builds a new state); a stale reason needs a hand rewrite with no rerun and no admin restart, and the words are still true of that run.
- `apps/indusk-admin/src/lib/plan-actions.ts:48` — `canApprove` dropped its `!building` and `implStatus !== undefined` conditions and now rests on `waitingOn === "approval"` alone. A14, the row on what a page offers, feeds only draft-impl inputs; no row checks a plan whose position is in the build with a draft impl.
  - breaks when: a plan already in its build has its impl frontmatter returned to `draft` (with no amendment counted) — `awaitingApproval` in `waiting.ts` does not look at position, so the brief page offers Approve on a building plan where before it did not.
  - answer: nothing — `awaitingApproval` requires a `draft` impl; a building plan's impl is `approved`/`in-progress`/`completed`, so the dropped `!building` check is subsumed. Returning a building impl to `draft` by hand is outside any flow.
- `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:99` — the plan page's own Approve is drawn when `actions.canApprove && waiting?.on !== "approval"`; since `canApprove` is now true only when `waiting.on === "approval"`, this condition can never be true, so the plan page's own Approve button is unreachable and Approve exists on that page only through the DecisionCard. No row asserts which Approve the plan page draws.
  - breaks when: the DecisionCard is not drawn for a plan waiting on approval (a layout branch, a render error in the card); the plan page then shows no Approve at all, and nothing fails.
  - answer: nothing — intended: impl decision 5, a decision recorded while writing the approved impl, puts Approve on the plan page on the decision card alone so it is never offered twice; the unreachable branch is that rule.

## What does the code do that the brief never promised?
- `apps/indusk-admin/src/lib/decisions.ts:169` — answering a plan-review card when the plan has no session open starts a new `planning` Claude session with `replyPrompt`, for either answer. The brief's "Not promised" says restarting a stopped run is the person's (rerun, or the agent writes the review by hand); it promises a listing, not that the card launches an agent. A19, the row on plan-review answers, checks only that neither answer approves or releases.
  - breaks when: the person clicks "Not yet" on a hand-written plan's plan-review card — a planning session is spawned with the prompt "They answered, in their own words: > Not yet … Carry on with <plan> from there", which carries on planning the very thing the person declined, and takes a session slot.
  - answer: nothing — every non-approval, non-review answer already goes to the plan's agent as words, starting a planning session when none runs (the same path as approval's "Not yet — keep planning"); the reply prompt carries "Not yet" verbatim, and A19, a test-plan row asserting answers never approve or release, is what the brief's Must-not-break asks.
- `apps/indusk-mcp/src/lib/plans/waiting.ts:252` — a run stopped on `wait-for-looks` is listed as `plan-review` with "Ask the agent to write it", though the run never reached the review step because a look is unapproved. The brief promises the listing and that the decision says why; it does not promise that the card's action points at the review while the actual block is a person's look approval.
  - breaks when: a run stops waiting for looks and the person accepts the card — an agent is asked to write `plan-review.md` against a brief whose looks are still unapproved, before the run would have read it cold.
  - answer: nothing — the brief's changed promise lists any written impl without an answered plan review, no run going, as needing its plan review, and the decision names the looks wait; listing it as a looks wait instead would change the promise sentence (an amendment), not warranted for a stop the person already sees in the words.

## Which rejected ADR alternative does the code quietly take?
- nothing

## What let these through?
- UI joins proved by proxy: what a page draws is tested by source text and function names while the only rendered check is a deferred live check — findings: `plan-actions-pages.test.ts:24` (A15), `cockpit-single-definition.test.ts:103` (A11), `impl.md:74` (A16), `page.tsx:99` — highlight: h-20261019-018
- A new waiting kind inherits the default answer route and every stop that reaches it, unstated in the brief — findings: `decisions.ts:169`, `waiting.ts:252` (both questions), `build-host.ts:427` — highlight: h-20261019-019
