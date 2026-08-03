# Happy-path fixtures never exercise lifecycle transitions — walk long-lived entities through archive/re-open/growth in the original test trajectory

dawn-ui-plan-grouping authored 10 trajectory rows covering every create-time shape (missing declarations, corrupt YAML, empty parents, uncreated children) — and the falsification ritual still confirmed five real bugs, every one of them a *lifecycle* edge the original fixtures never reached: a subplan whose folder had been ARCHIVED rendered as "not created yet"; a parent that GREW standard documents had them suppressed; a SECOND parent arriving broke declared ordering; names GOING BAD (traversal segments, duplicates) reached path joins and double-renders.

**The pattern:** fixtures authored at feature-planning time describe entities at the moment of creation. Entities that live long (plans, users, jobs, documents) transition — archived, re-opened, renamed, multiplied — and each transition is a distinct input class the create-time fixtures structurally cannot cover.

**What to do instead:** when writing a test plan for a feature over long-lived entities, explicitly walk each entity through its full lifecycle and author a row per transition: what does this look like when the thing is archived? when it comes back? when there are two? when its identifier is malformed? The dawn case: the brief literally promised "done, in flight, and queued ahead" — "done" means archived, so the archived-child row was knowable on day one.

