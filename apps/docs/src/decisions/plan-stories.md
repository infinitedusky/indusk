# Plan titles and stories — a plan read by its title, a master that tells its story

**Decided 2026-10-14.** Full ADR: `.indusk/planning/archive/plan-stories/adr.md`.

## Goal

**Every plan is named by a short title a person would say, a master plan's page tells its story, and Needs you lists a plan waiting on an amendment.**

Today the nav, the plan page and the editor show `cockpit-redraw` where a
person would say "Cockpit redraw", and a brief's `title:` holds a sentence that
is really a description. Day's master page shows a progress bar, its prose and
26 cards named by handle, so it says nothing about what Day is doing. And a
plan waiting only on an amendment says so on its own page but is missing from
the nav's Needs you.

## Y-Statement

**In the context of:**
an admin and an editor that name plans by folder handle or by the part of a long `title:` before its dash, and master plans whose page lists subplans by handle with no line saying what the master is for,

**Facing:**
titles that are descriptions, plans that exist only in their own worktrees, subplans declared before they have a folder, and a Needs you rule that leaves amendments out,

**We decided for:**
one title rule in the package (the written title up to its dash, else the handle in words), read from the brief or the master, carried on each plan the admin reads from the copy it reads; titles and descriptions for not-yet-started plans written beside their names in the master's `subplans:`; a master plan page that tells the story with a new `subplan-row` component; `planWaiting` taking amendments, so one rule decides Needs you and the plan page; and the titles written into each live plan where the admin reads it, on its own branch for a plan in a worktree,

**And against:**
a separate `name:` field, a title rule in each page, story lines parsed from the master's prose, a retitle command, waiting for each plan to land, and counting amendments in the admin alone,

**To achieve:**
plans read as people say them, a master read whole from its page, and one place that lists every decision waiting on the person,

**Accepting:**
that archived plans keep the names they read by today, that a plan not yet started shows a title only where its master wrote one, and that writing on other plans' branches touches worktrees this plan does not own,

**Because:**
the display module is already the one place a plan is named, the declarations already order a master's plans, `planWaiting` is already the rule the nav and page share for every other wait, and the admin already reads a worktree plan from its worktree.

## Decision

1. **One title rule, in the package.** `planTitle(title, handle, words)`
   answers the written title up to " — "; when there is none, or it is only
   the handle (as `indusk plans start` writes it), the handle in words through
   `promiseWords`. The title is read from `brief.md`, else `master.md`; the
   description is that file's `description:`, a separate field. The 11
   archived plans whose title is only their handle now read as words; the rest
   keep the part before the dash they read by today. `readHealthNames` reads
   `master.md` too, and the health line falls back to the handle in words, so
   the editor never shows a bare handle. The admin's `Plan` carries `title`
   and `description`, set by `planning-reader` from the copy it reads (the
   worktree first) through `planTitle`. Every place the admin names a plan
   (nav rows, Paths, Needs you, initials, page heading and crumb, master rows)
   reads `plan.title`; the handle stays in links, addresses and data
   attributes.

2. **A master writes titles for plans not yet started.** A `subplans:` entry
   is a name, or a mapping `{ name, title, description }`. The parser keeps
   both in declared order and reports the written title and description
   beside the names. A plan's own brief wins once it exists. Children still
   declare nothing.

3. **The master plan page tells its story.** A plan with declared subplans
   gets the `plan.master` page instead of the bar, the prose and the cards:
   title, description, a count line (released, drafts, queued) and "Read the
   master plan" (`/doc/master`, newly served), then "The plans, in order".
   The rows and counts come from the same Path group `buildGroups` builds for
   the nav, so the page and the nav's `released/total` cannot disagree. A row
   is `released` when a release shipped the plan (the Path count's rule),
   `queued` when the plan has no folder, else `draft` with the stage words the
   nav row shows. The page reports `data-look-state="plan.master"`.
   *As built:* the story replaces only a plan's rail, status card and parts;
   the master page keeps the trust notice, the amendment or decision card,
   *Ask about this plan*, the build controls and the history, so a master
   that waits on the person is answered from its own page (found by the
   cold audit, fixed in Build Phase 8).

4. **`subplan-row` is a component.** `SubplanRow` with stories `released`,
   `draft` and `queued`, approved against their mockups; `plan.master` is
   recomposed to place it by name. The nav's story is retitled, so `nav.*` and
   every mockup placing the nav reopen for Sandy's approval.

5. **Needs you counts an amendment, by one rule.** `planWaiting` takes the
   amendments waiting per plan and reports `on: "amendment"` at the Brief
   step, after a question and before review and approval. The admin finds
   them only for a plan whose brief no longer matches its approval hash, so
   the nav costs a git read only for those. The plan page's look state uses
   the same answer and `planPageWaiting` goes. The page shows the amendment
   card, not a decision card, and the decision route refuses an amendment, as
   accepting it would otherwise run a release.

6. **The titles are written where each plan is read.** A plan with no
   worktree is retitled on this branch and reaches `main` when it lands. A
   plan assigned to a worktree is retitled in that worktree, on its own
   branch, one frontmatter-only commit per plan. Amendments compare a brief's
   expectations, promises and looks, not its frontmatter, so an approved plan
   waits on nothing new. A worktree whose plan folder has uncommitted changes
   is skipped and listed in `.indusk/current.md` for its next session, as is
   the untracked `approve-then-improve` on `main`, which is the person's.
   Archived plans are not touched.

7. **The contract test serves the approved path.** `screens.json` already
   lists `plan.master` and `subplan-row` at `/p/dusk/plan/indusk-v4-day`. The
   test's throwaway project names its fixture master `indusk-v4-day`, so the
   approved declaration is unchanged and the real Day page is checked by
   `indusk looks check admin` as well.

## Alternatives Considered

### A separate `name:` field beside `title:`
Rejected. Sandy settled a handle, a title and a description. What `title:`
holds today is moved to `description:` where a plan has none.

### Naming plans in each page
Rejected. The display module exists so the editor and the admin do not each
turn a handle into words, and `display-names-single-definition.test.ts` holds
it.

### Story lines taken from the master's prose
Rejected. The plan-parser moved off prose because structure read from prose
fails without a sound. The `subplans:` list already holds the order.

### A `plans retitle` command
Rejected. The titles are written once, from the research. A command nobody
runs twice is code to keep for nothing.

### Titles applied when each plan lands
Rejected. The admin reads a plan in a worktree from that worktree, so its
handle would show until it lands, and the second expectation could not hold.

### Amendments counted in the admin only
Rejected. That is the second rule the nav and page disagree by today.

### Keeping the master bar
Rejected by the approved `plan.master` mockup, which replaces it with the
count line.

## Consequences

### Positive
- Plans read as people say them, in the nav, the pages and the editor.
- Day's and Dawn's pages say what each is for and how far along it is.
- Needs you lists every decision waiting on the person.

### Negative
- Archived plans whose title starts with something other than their handle
  keep the part before the dash, which can be longer than a new title.
- A not-yet-started plan has a description only if its master writes one.
- Retitling touches other plans' branches.

### Risks
- An agent working in a worktree while it is retitled. Mitigation: skip any
  worktree whose plan folder has uncommitted changes; the commit touches only
  the brief's frontmatter.
- Longer names in the nav. Mitigation: `the-nav-fits-a-phone`'s test runs with
  a long title; rows end in an ellipsis with the whole title in `title=`.
- Each retitled nav story reopens 20 mockups. Mitigation: the story changes
  once, `indusk looks stories admin` renders it, then Sandy approves in one
  pass.

## References
- [The admin overview](/reference/admin-ui/overview) — the nav, the master plan page, Needs you
- [`indusk plans`](/reference/cli/plans) — `subplans:` entries with a title and description
- [Briefs](/guide/briefs) — `title:` is a short name, `description:` is separate
- [Display names](/decisions/display-names) — the one module that names a plan
- [Cockpit redraw](/decisions/cockpit-redraw) — the nav and plan pages this retitles
