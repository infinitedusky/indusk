# Dawn UI Plan Grouping — Lessons

Lessons from the `dawn-ui-plan-grouping` plan (2026-08-03): top-down plan-hierarchy declarations, the grouped admin sidebar, and the parent detail view. Full history in the archive: `.indusk/planning/archive/dawn-ui-plan-grouping/`.

## Happy-path fixtures never exercise lifecycle transitions

The plan authored ten trajectory rows covering every *create-time* shape — missing declarations, corrupt YAML, empty parents, uncreated children — and the falsification ritual still confirmed **five real bugs**, every one a *lifecycle* edge:

- a subplan whose folder had been **archived** rendered as a "not created yet" placeholder;
- a parent that **grew** standard documents had them silently suppressed;
- a **second** parent arriving broke the declared ordering;
- names **going bad** (traversal segments, duplicates) reached a filesystem path join and double-rendered.

Entities that live long — plans, users, jobs — transition. Each transition is an input class that create-time fixtures structurally cannot cover. When test-planning a feature over long-lived entities, walk each entity through its full lifecycle and author a row per transition. In this case the brief literally promised "done, in flight, and queued ahead" — *done means archived*, so the archived-child row was knowable on day one.

## Declaration names are boundary values

Anything read from frontmatter and then joined into a path or rendered verbatim needs the same sanitize-at-the-boundary treatment as session IDs and research slugs. The repo had the convention; the new declarations parser initially didn't apply it — `parents: ["../../../x"]` read a `master.md` outside the planning directory. The fix (segment guard + first-occurrence dedupe inside the parser) means the bad name loses its structure, never causes a traversal, and never renders raw.

## Two surfaces resolving the same data independently will disagree

The sidebar resolved subplan children from active plans only; the detail page resolved from active + archived — with inverted precedence. The same plan rendered as a greyed placeholder in one surface and a real card in the other. One resolution rule (active + archived, active wins), applied identically everywhere, is the fix — and the test asserts the two surfaces agree, not just that each behaves.

## A fresh worktree is not a trunk-equivalent test environment

Twelve daemon/tarball test failures in the plan's worktree pattern-matched to regressions; the actual cause was a **gitignored build artifact** (the bundled admin app) that exists on trunk only by accident of history. Baseline-compare the same tests on unmodified `main` before diagnosing worktree failures as regressions, and ask "what gitignored state does this test depend on?"

## Labels for meta-states must not reuse lifecycle vocabulary

The placeholder badge originally said `planned` — which reads as a plan-lifecycle stage the declared-but-uncreated names never reached. User feedback mid-plan renamed it `queued`: it says exactly what the entry is (declared in a sequence, nothing more) without borrowing a word that means something else one table over.
