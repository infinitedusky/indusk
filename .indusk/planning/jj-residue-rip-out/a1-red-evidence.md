---
title: "A1 Red Evidence"
date: 2026-08-14
---

# A1 — observed red before any removal

The `git-only-substrate` audit was green for seven weeks while jj was live. The
whole point of this plan is a tripwire with a **demonstrated** red state, so this
file records the observation rather than asserting it.

Captured on the pre-removal tree, at `plan/jj-residue-rip-out` commit `81055232`
(baseline `0350930a`), before Build Phase 1.

## Command

```
pnpm vitest run apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts -t "A1"
```

## Output, verbatim

```
AssertionError: jj is still live in:
  apps/indusk-mcp/src/lib/config.ts:77 — scm: "jj"
  apps/indusk-mcp/src/bin/commands/update.ts:616 — scm: "jj"
  apps/indusk-admin/src/lib/vcs.ts:28 — execFileSync( "jj": expected [ { …(3) }, { …(3) }, { …(3) } ] to deeply equal []
```

## Why each line matters

**`vcs.ts:28`** is the violation the predecessor could not see, and it needed all
three of this audit's corrections to surface at once:

1. It is in `apps/indusk-admin/`, which the old `SRC_ROOT` (`apps/indusk-mcp`)
   never scanned.
2. It is an argv string, not a TypeScript identifier — none of the old audit's
   five patterns could match it.
3. It spans lines 28–29:

   ```typescript
   const out = execFileSync(
     "jj",
   ```

   The old audit tested each line in isolation, so even a correct argv pattern
   would still have missed it. The reported match text `execFileSync( "jj"` shows
   the whole-file matching working across that newline.

**`config.ts:77` and `update.ts:616`** are the back-compat shim — the
`scm?: "jj" | "git"` field and the `indusk update` nudge. Both were deliberate in
1.31.0 and are being closed now at 1.36.0.

## Full-suite shape at this point

```
Test Files  2 failed | 1 passed (3)
     Tests  3 failed | 8 passed (11)
```

Red: A1, A5, A6 — the three drivers.
Green: A2, A3, A4 — the three guards, exactly as the test plan declared.

Every failure is an `AssertionError` carrying its violation list, not a module
load error. A test whose file cannot resolve an import has not been authored; it
is an absent test wearing a failure's clothes, and the exit code looks identical.
