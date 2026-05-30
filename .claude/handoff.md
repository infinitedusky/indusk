# Handoff

**Date:** 2026-05-30
**Session:** Shipped all 7 phases of `indusk-worktree-extension` plan end-to-end. Multi-day session: started on telemetry binary install issues, moved through planning restructure (Immediate queue + Arc 0 Midnight) and shape revision (flat single-repo workbench), then executed Phases 1–7 of the worktree extension.

## What Was Being Worked On

`indusk-worktree-extension` plan — all 7 phases plus a mid-stream shape revision. 18/18 trajectory rows passing. 567 tests in indusk-mcp. 12+ commits to `origin/main`. Plan impl status: `in-progress` → ready for `/falsify` + `/retrospective` close-out.

## Where It Stopped

Phase 7 closed and merged to main (commit `99e7748b`). All trajectory rows in `passing` state. Plan is implementation-complete but NOT archived — three close-out steps remain (publish + falsify + retrospective).

The last thing Sandy did was request: "commit everything, I'm going to be running this on a different computer. I'm going to be cloning you." So everything is pushed; the next session likely starts on a fresh clone on a different machine.

## What's Next

In order:

1. **Publish indusk-mcp 1.28.26 to npm.** Sandy's 2FA needed: `cd apps/indusk-mcp && pnpm publish --no-git-checks`. Without this, the global `indusk` is still 1.28.25 and the `worktree` subcommand doesn't exist — so `indusk extensions enable worktree` will fail with "unknown command 'worktree'" when on_enable fires (verified in-stream this session). Either publish 1.28.26 OR set `INDUSK_BIN="node /path/to/dist/bin/cli.js"` for dev usage.
2. **`/falsify indusk-worktree-extension`** — required before retrospective. Same-agent goal-flipped bounty hunt; appends a Falsification Phase to impl.md with hypothesis tests + fix items.
3. **`/work indusk-worktree-extension`** — execute any falsification-phase fix items if /falsify surfaces them.
4. **`/retrospective indusk-worktree-extension`** — closes the plan and archives.
5. **(Sandy-time, separate)** — execute the numero migration via the Flow B runbook in `apps/docs/src/guide/worktree-setup.md`. Not blocking plan archive.

## Open Issues

- **Global `indusk` is at 1.28.25** — predates the `worktree` subcommand. Until 1.28.26 publishes OR you set `INDUSK_BIN` to point at dist, `indusk worktree _on-enable` will fail with "unknown command". The on_enable hook ITSELF has a try/catch via `runHook`, so the failure surfaces as `"  worktree: on_enable hook failed"` in init's output — visible but easy to miss.
- **`apps/docs/` build artifacts under `.vitepress/cache/` and `.vitepress/dist/`** — covered by `.gitignore` updates already, but a fresh clone won't have them; running `pnpm dev:docs` regenerates them.
- **No real falsification failures expected** — all 18 trajectory rows pass cleanly; /falsify may surface surprises but the substantive implementation has been dogfooded against demo + scratch workbenches all session.

## Decisions Made This Session

All major decisions are in CLAUDE.md already. The load-bearing ones, for quick recall:

- **Flat single-repo workbench shape** — trunk symlink + worktrees as siblings at workbench root. Dropped the original `production/<repo>/` + `worktrees/<slug>/` split. Multi-repo workbenches (dawn-fde-toolkit-style) deferred to a future "FDE agency" plan. Documented in CLAUDE.md Conventions.
- **Per-developer workbench model** — wrapped repo is the only shared/versioned thing. Workbench is local-only per-developer scaffolding; planning history doesn't sync between teammates by design. Documented in CLAUDE.md Known Gotchas + the new setup-workflows guide.
- **TS shim pattern for extension hooks** — `indusk <ext> _<hook>` invokes a small TS shim that walks `__dirname` up to find the indusk-mcp package root, then shells out to the extension's bash hook. Works for both global installs and dev monorepo. Documented in CLAUDE.md Known Gotchas. Reusable for future extensions whose hooks need more than a one-liner.
- **Numero migration deferred** — per Sandy's explicit "defer the numero migration; finish the plan via demo + a second throwaway workbench" choice. Captured as Flow B runbook in the new guide.
- **Workbench bootstrap is two-step (not init-clones-the-repo)** — user runs `git clone <wrapped-repo>` themselves; `indusk init --workbench` just wires up the workbench AROUND an existing canonical clone. Documented in guide Flow A.

## Watch Out For

- **Next session likely on a different machine.** Sandy said they'll be cloning to a new machine. Fresh clone of `git@github.com:infinitedusky/indusk.git` will have everything as of `99e7748b`. They'll need: `pnpm install` + `pnpm --filter @infinitedusky/indusk-mcp build` + globally install indusk-mcp at 1.28.26 (once published) or set `INDUSK_BIN`.
- **`~/code/sandbox/wt-demo-workbench/` and `~/code/sandbox/wt-scratch-workbench/`** are local-only test artifacts on the ORIGINAL machine. They won't exist on the new machine. If the next session wants to re-dogfood, recreate them via the guide Flow A.
- **The `~/code/sandbox/wt-demo-repo/` and `~/code/sandbox/wt-scratch-repo/`** scratch git repos also won't exist on the new machine. Same — recreate via the guide.
- **Don't write the Phase 7 falsification phase yet without thinking** — `/falsify` is a separate skill that will hypothesize + author the phase. Don't preempt it.
- **`.claude/handoff.md` (this file) is gitignored.** A fresh clone won't have it. If the next session is on a different machine + fresh clone, this handoff doesn't survive. Sandy may need to re-orient via `/catchup` from scratch (CLAUDE.md + master.md + impl.md will have all the context).
- **`indusk-mcp 1.28.25` is the currently-published latest.** `pnpm i -g @infinitedusky/indusk-mcp@latest` will get 1.28.25 (no worktree command). The `worktree` subcommand only exists at HEAD (1.28.26-pending).
- **Stale registry entries** in `~/.indusk/projects.json`: `demo-workbench-2` and `demo-workbench-3` (from Phase 6 init-workbench test iterations), plus the older `tmp.Hs50dNzRUK` and the test fixtures from init-workbench.test.ts. Telemetry logs `Skipped N project(s) (missing path or write failed)`. Not blocking; candidate for cleanup pass.

## Catchup Status
- [ ] mcp-ready
- [ ] handoff
- [ ] lessons
- [ ] skills
- [ ] health
- [ ] context
- [ ] plans
- [ ] extensions
