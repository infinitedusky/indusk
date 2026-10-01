---
title: "Upgrade reports on the version we just released"
date: 2026-10-01
status: draft
workflow: bugfix
---

# Upgrade reports on the version we just released — Brief

## Problem

Since npm's publish-time malware scanning reached this package (announced
2026-07-28, felt here from about 1.50.0 on 2026-09-17), a version is not
installable for about five minutes after `npm publish` returns — fifteen or
more at peak or for large packages ([GitHub Changelog](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)).
1.55.0 took 5 m 45 s. npm answers 404 for the version until the scan ends, which
is indistinguishable from a version that does not exist.

Our tooling assumes the old behaviour. `record-release.js` gives up after 15
seconds and writes "did not confirm" every time. `indusk upgrade` answers
"already at v1.54.0" — a statement about the version nobody asked about —
while the operator is waiting for 1.55.0. So every release ends with repeated
upgrade attempts and no information. It also produced a wrong diagnosis: 1.51.0
was recorded as a publish the registry never received, and released twice,
when it was almost certainly still being scanned.

## Proposed Direction

1. **`pnpm release` records what it uploaded.** After `pnpm publish` exits 0,
   it writes the version and upload time to a machine-local record
   (`~/.indusk/`), so the expectation exists before npm can confirm anything.
2. **`indusk upgrade` reports on the expected version.** When a recorded
   release is newer than what is installed, upgrade talks about *that*
   version: still in npm's scan (with minutes since upload, and npm's stated
   range), or live — in which case it upgrades and says so — or overdue, past
   npm's range, naming where to look. The installed version and npm's
   `latest` are mentioned only when nothing is expected.
3. **`pnpm release` waits out the scan.** It polls until the version is live,
   with progress, for up to about 20 minutes, then says to run
   `indusk upgrade`. The `current.md` note is written then — "published" on the
   registry's word, or "still scanning after N min" — instead of after 15
   seconds.
4. **The note names the real error.** It quoted the first stderr line, which
   was an unrelated npm warning, not the 404.
5. **Correct the record**: the root master's 1.51.0 entry says the registry
   never received the publish; it was most likely in the scan.

## Scope

### In Scope
- The machine-local release record (written by `pnpm release`, read by
  `indusk upgrade`)
- `indusk upgrade`'s messages when a release is expected
- `pnpm release` waiting for availability; `record-release.js`'s note and error
  text
- The 1.51.0 diagnosis in the root master

### Out of Scope
- Shrinking the tarball to shorten the scan (measure first; separate decision)
- Consumers on other machines who did not run the release — they keep today's
  behaviour; nothing on their machine knows a release is expected

## Success Criteria
- Right after a release, `indusk upgrade` says the new version is still in
  npm's scan and for how long — and never "already at <old>"
- Once npm finishes, the same command installs the new version
- `pnpm release`, left running, ends with the version live and a note that
  says "published" on the registry's word

## Depends On
- Nothing

## Blocks
- Nothing
