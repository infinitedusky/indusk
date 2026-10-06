---
title: "publish-hygiene — research"
date: 2026-10-06
status: complete
---

# publish-hygiene — Research

## Background

`pnpm release` for 1.63.0 (release commit 91cb5505) ran twice from Sandy's
terminal, at 15:24 and 16:08. Both runs stopped in `pnpm -w test:system`, on
one test:

```
× a write is asked about in a planning session, and a denial is heard
  session-protocol-contract.test.ts:90 — no permission event for Write
```

The same tier passed 157 of 157 run from inside a Claude Code session, twice.

## Findings

- **The contract test depends on the model choosing to write.** Its prompt
  says "Create a file named hello.txt … If you are not allowed, say DENIED
  and stop." A probe running that session with this repository's code:
  - inside a Claude Code session (its `CLAUDE_*` environment inherited):
    three of three runs called `Write` and were asked;
  - with a clean environment, as a terminal starts it: two of nine runs
    answered "DENIED" without calling any tool ("Writing files is disabled in
    this session's permission settings…"; once citing the global
    instructions). No tool, so no permission event, so line 90 fails.
  
  When a write was attempted it was asked about and the denial was heard every
  time, so the protocol behaviour the test guards held; the setup did not.
- **The tarball is mostly source maps.** `npm pack --dry-run` of 1.63.0: 1,170
  files, 41.5 MB unpacked, 10.7 MB compressed. Of that:
  - 160 `.map` files make up 26.7 MB, almost all under `admin/.next/`;
  - `admin/.next/trace`, `admin/.next/trace-build` and `admin/.next/types/`
    are build artefacts nothing runs.
  
  `scripts/bundle-admin.js` already filters `.next/cache` and `.next/dev`.
- **The release prints one line per file.** `npm publish` logs the tarball's
  contents at `notice` level (`npm notice 277B admin/…`), over a thousand
  lines, which pushed the failure off the screen. npm prints the 2FA URL with
  `output.standard` (`lib/utils/open-url.js`, npm 11.12.1), which loglevel
  does not gate, so `npm_config_loglevel=warn` on the publish hides the
  listing and keeps the prompt, warnings and errors.
