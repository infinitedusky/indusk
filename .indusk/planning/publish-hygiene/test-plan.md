---
title: "publish-hygiene — test plan"
date: 2026-10-06
status: accepted
---

# publish-hygiene — Test Plan

| ID | Assertion | Kind |
|----|-----------|------|
| A1 | A planning session that is asked to write a file asks first, and hears a denial — whether or not the model would have chosen to try, the test sets it up so the write is attempted, tries again once when the model answers without trying, and says so plainly when it never tries | contract |
| A2 | The published package carries no source maps, no Next build trace and no generated types, and the admin still starts from it | contract |
| A3 | The release's publish step prints npm's warnings, errors and 2FA prompt, and not one line per packed file | unit |

A1 runs against the developer's own `claude` in the system tier. A2 extends the
existing tarball test (`admin-bundle-pack.test.ts`, system tier), which packs
the real package. A3 reads the release script: what it asserts is the
environment the publish runs in, and the reason that environment keeps the 2FA
prompt is recorded in research (npm prints it unconditionally).
