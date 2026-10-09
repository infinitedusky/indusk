---
title: "system-tests-catch-up"
date: 2026-10-09
status: draft
workflow: bugfix
---

# system-tests-catch-up — Brief

The 1.69.0 release stopped on three system-tier tests that were left behind by deliberate changes on 2026-10-08, when the system tier no longer ran at landing:

- `apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts` A20 looks for "open violations … before/ahead of … the roadmap" in the catchup skill; `7d3d0545` reworded the skill to "Open incidents and open violations outrank the roadmap", which says the same and fails the regex.
- `apps/indusk-admin/src/__tests__/http-promise-remote.test.ts` A17 expects the promise its file broke in production to read `unverified` once the server is unreachable. Since incident-recording, the admin records that break as an incident, which moves the promise to `known-violated`, and a known-violated promise is `amber` whatever telemetry says: the code is right.
- `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts` A9 hand-writes an incident, then marks it fixed, and expects `fixed`. The admin has already recorded the same break as its own incident, which stays open, so the chip stays `red`: the code is right.

The code does what incident-recording and the catchup rewording promised; the tests are fixed to assert it.

## Expectations

None — a test-only repair; what it changes is that the system tier passes, which its last row proves.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`a-production-break-is-recorded-unasked`**. The two admin tests are repaired around the recorder, never by switching it off.
- **`an-open-incident-stays-loud`**. The catchup skill keeps open incidents and violations ahead of the roadmap; only the test's wording check widens.
- **`catchup-records-what-it-finds`**. The catchup skill text is not changed.

**Changes**

None.

**Replaces**

None.

### Not promised

- Running the system tier at landing again, so tests cannot fall behind silently: release-records-its-failures records what the slow tests find after a release; landing is its follow-up.
- Giving these old rows `For` cells: the archived-rows backfill named in release-records-its-failures.

## Depends On

- None.

## Blocks

- The 1.70.0 release (`release-records-its-failures`' live check runs against a green system tier).
