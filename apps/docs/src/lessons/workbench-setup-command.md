# Workbench Setup Command — Lessons

Reusable insights from building `indusk setup <cloned-repo-path>` (the one-shot workbench creator). Full process history: `.indusk/planning/archive/workbench-setup-command/`.

## Delegate to an existing command instead of extracting a helper — when the callee already IS the whole flow

The brief proposed extracting the workbench-init block out of `init.ts` into a shared function that both `init --workbench` and the new `setup` command would call. The impl instead had `setup` derive its arguments and call `init(workbenchDir, { workbench: true, ... })` directly.

Why delegation won:

- `init --workbench` **already is** the encapsulated workbench-init flow (trunk symlink + `worktree` config block + extension enable). There was no seam to extract — the "shared function" already existed as a public entry point.
- Delegation means **one code path, zero drift**. Two copies of workbench-init logic can diverge; a wrapper cannot.
- It made the regression guard **free**: the "does `init --workbench` still produce a valid workbench?" test (T7) became a near-tautology, because `setup` literally invokes that path.

**Rule of thumb:** reach for extraction only when the shared logic is *not* already a callable unit. If it already is one, wrapping it is simpler and eliminates drift by construction. When the impl deviates from the brief this way, flag it — it's a design improvement, not a shortcut.

## Falsification earns its keep on "creates nothing on failure"-style claims

Phase 1's seven tests were all green, and the brief asserted: *"all guards run before any `mkdir`, so a failed setup creates nothing."* That claim is true for **guard** failures (non-git path, collision) — and silently false for **init-stage** failures. The scaffold+`init` block had no `try/catch`, so an `init` failure *after* `mkdirSync` left a partial `<repo>-workbench` behind — which then tripped the (misleading) collision guard on retry, locking the user out of both completing and cleanly retrying.

Happy-path tests can't catch a claim whose prose is scoped more broadly than the code guarantees. The falsification ritual — reading the code against its own attested claims — is exactly the tool for that gap. It surfaced two real, in-scope bugs here (workbench-blind collision guard; non-atomic setup), both fixed in a Phase 2 that closed cleanly.

## Verify a fault-injection induction empirically before authoring the test around it

To test atomicity (setup cleans up a partial workbench when `init` fails), the test needed a deterministic way to make `init` fail *after* the workbench dir was created. The candidate — point `INDUSK_HOME` at a regular file so init's registry write fails — was only *moderate*-confidence until it was run by hand. That run confirmed three things that made the test real rather than hopeful:

1. `init` actually throws (`ENOTDIR`).
2. It throws *after* the dir is created (so the partial-state bug is genuine).
3. The throw is a **catchable rejected promise**, not an uncatchable `process.exit` — because `addProject` is a synchronous call inside init's async body, so a sync throw there rejects the promise that `await init(...)` awaits.

A fault-injection test is only as good as the fault it injects. Run the induction, read the actual error and its propagation path, *then* write the test. This is the line between bounty-hunting and candidate-generation.

## Bonus: `rmSync` on a directory containing a symlink is symlink-safe

The atomic cleanup `rmSync`es the workbench dir on failure — and that dir contains the trunk symlink pointing at the wrapped repo (`<repo>-workbench/<repo> -> ../<repo>`). `rmSync` removes the symlink **as a link**; it does not recurse into the target. That property is what makes cleanup safe — without it, deleting the workbench would risk deleting the user's actual repo.
