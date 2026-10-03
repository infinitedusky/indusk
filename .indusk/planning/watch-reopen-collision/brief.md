---
title: "watch opens an incident and silently does not reopen its owner"
date: 2026-10-02
status: accepted
workflow: bugfix
---

# Brief

## The problem

Found in the numero-workbench promise smoke (Sandy, 2026-10-02). `indusk
promises watch --source smoke` printed

```
opened i-2026-10-02-table-chat-keeps-line-breaks (table-chat-keeps-line-breaks, 2 new traces)
```

and nothing else. No Maintenance phase was appended to the owner
(`promise-smoke`), and no line said so. A violation became an incident that
no plan owned, and the output read as success — the one outcome the monitor
exists to prevent.

### How it happened

Earlier the same day the promise had an incident with the same id; the person
deleted that incident file (resetting the smoke), but its Maintenance phase —
`### Build Phase 3: Maintenance — i-2026-10-02-table-chat-keeps-line-breaks` —
stayed in the owner's impl, as phases do.

1. **The id was reused.** `newIncidentId` (`lib/promises/incidents.ts:54`)
   only asks whether `incidents/<id>.md` exists. With the file gone, the next
   incident of that promise on that day got the bare id again.
2. **The reopen saw a stale heading and said "already".** `reopenOwner`
   (`lib/promises/reopen.ts:105`) dedups by heading name. That is right for an
   *extended* incident — its phase exists — and wrong for a newly *opened*
   one, where a matching heading can only be a collision.
3. **The CLI swallowed it.** `promises watch` (`bin/commands/promises.ts:124`)
   prints `copy-problem` and `no-owner` but nothing for `already`, so the
   skipped reopen was invisible.

Deleting an incident file is not a normal operation, but nothing refuses it,
and a reused id is not the only way a stale heading can match: any heading
carrying the same incident name does.

## Proposed direction

Both halves, decided at acceptance (Sandy, 2026-10-02):

- **An opened incident never matches an existing heading.** The id allocator
  also skips any id that already names a Maintenance heading in the owner's
  impl, so the numero case cannot recur — no collision is representable from
  a deleted incident file.
- **A collision that happens anyway is said.** `reopenOwner` is told whether
  the incident was opened or extended. An *extended* incident whose phase
  exists stays quiet, as today. An *opened* one whose heading already exists
  (a hand-written phase, anything else that carries the name) returns
  `collision`; `watch` prints an error naming the owner and the heading and
  exits non-zero. A reopen that did not happen never reads as success.

`watch` has one caller, the CLI: the always-on pass detects and notifies and
never reopens, and no MCP tool or admin page reports watch results, so there
is no second reader to bring into agreement.

## Test cases (for the test plan)

- Delete an incident file whose Maintenance phase remains, break the promise
  again the same day: the new incident gets a fresh id (`-2`) and the owner
  gains a new Maintenance phase.
- An extended incident still writes no second phase and prints no error.
- A forced collision (heading exists for an opened incident) prints an error
  naming owner + heading and exits non-zero.

## Workaround used in the smoke

Renamed the new incident to `-2` by hand and called the shipped
`reopenOwner` directly; it appended Build Phase 5 correctly.

## Related, out of scope

- `watch` and `reopenOwner` write `impl.md` with `writeFileSync`, so the
  project's impl validator never sees what they append — a generated phase is
  checked only when a person next edits the file.
