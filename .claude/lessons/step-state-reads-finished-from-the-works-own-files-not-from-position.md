# A step list derived from the plan's one lifecycle position forgets finished work when the plan reopens — read "finished" from the work's own files (closed phase, audit.md) and keep position for "where is it now"

Seen on plans-are-promises: falsification, cleanup and audit were finished, then an audit follow-up build phase reopened the plan, and the plan page read all three as "not yet" because releaseStep read them only from the plan's single position.

What to do: derive "finished" for a ritual from its own files (a closed ritual phase, a legacy falsification log, a written audit.md); keep the position for "where is the plan now". A skip with a reason still reads skipped, never done.

When two places (the plan page, the retrospective gate) must agree on a derived fact, define it once in the package (finishedRitualsOf in cleanup/gate.ts, beside skippedRitualsOf) and add it to cockpit-single-definition.test.ts; a copy in the admin is the bug waiting to happen.

Pointer: .indusk/planning/archive/finished-rituals-stay-done/retrospective.md; apps/indusk-mcp/CLAUDE.md (the release-step rule). Source: highlight h-20261016-016.
