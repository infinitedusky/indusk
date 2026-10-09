---
title: "VS Code extension — Retrospective"
date: 2026-10-09
status: complete
---

# VS Code extension — Retrospective

## What We Set Out to Do

Put each promise at the line in the editor that keeps it, show a break there within ten seconds of it being readable, and start the developer's own `claude` on the fix in one click, reading health from the same one place the admin does. The brief made five promises: a promise shows where it is kept; the editor shows the same health as the admin; a break reaches the editor; a break opens a fix in one click; the editor only shows.

## What Actually Happened

The plan was built as designed, then grew twice after Sandy used it.

- **Health moved into the package.** The admin's health reader and mark store became `promises/health` and `promises/store`; the admin, `indusk promises health --json`, the agents' `promise_health` report and the editor all read them. A7, a single-definition pin, refuses a second copy.
- **The extension is presentation only.** A pure core (`src/core/`) turns each health line into markers, hovers, problems, notifications, the fix action and the panel; `extension.ts` and `panel-view.ts` apply them. It reads one long-lived `indusk promises health --json --every 5` and writes nothing.
- **Install is one command.** The `.vsix` ships in the npm package; `indusk editor install` installs it into VS Code and Cursor.
- **Two promises were added after Sandy tried the build** (Build Phase 6): a panel listing every promise with broken ones first as cards, and an activity section adding each run as it arrives. Then, at Sandy's request, the panel named its project and grouped promises by plan, newest run first (Build Phase 7).

On the demo app a break showed in VS Code **5.3 s** after the late release was marked (A11); Cursor showed the marker and opened the fix terminal.

Structure: 85 commits; 77 files, +5,833 / −788. The new app is 36 files (+2,406); the package +1,365; the admin −715 net, its health code moved out; docs +219.

## Getting to Done

- **The live probe charged the demo's own delay to the editor.** A11 first timed from the seat hold, which includes the demo's deliberate 9.5 s; it now times from the late release.
- **Two VS Code launch traps** blocked the install contract test: a VS Code terminal exports `ELECTRON_RUN_AS_NODE`, and a worktree path makes VS Code's socket longer than macOS allows.
- **Falsification found six real faults** (Build Phase 5): the health command read the registry once, so a fixed break stayed red until a reload; a break was told again after one failed read or a new violation; a reader that could not start said nothing useful; span text could type commands into the fix terminal (Ctrl-C ends the quoted line); span text rendered as links in hovers; a nested InDusk project's lines were judged against the outer one.
- **The registry check refused eight names nobody declared** — sample tokens spelled in tests and two comments reading "…promise: told". Landing runs this check; it would have stopped there.
- **`indusk editor install` installed a stale build** in the monorepo, preferring the package's copy over a newer extension build.
- **A passing live check proved nothing.** The demo app tags no project on its runs, and an untagged run counts for every project, so A28 was first satisfied by an hour-old run from another demo. The probe now counts only runs after its own holds; the demo-app fault is written into the demo master for demo-rehearsal.
- **"The activity stopped" was a window, not a bug.** Sandy's panel was in the dusk window, correctly showing dusk's promises. The fix was to name the project at the top of the panel.

## What We Learned

- **A live check must reject evidence older than its own action.** A probe that accepts "any run" passes on yesterday's data; one that timestamps its trigger and requires newer results does not. This held for A28 and is true of any check over a store that outlives the run.
- **Prose and test text can trip a grammar the project enforces.** InDusk's token grammar reads `promise: <word>` after a comment opener as a claim, so a sentence or a sample line becomes a lie in the registry. Build sample tokens; word comments around the colon.
- **Text from telemetry is untrusted input.** It reaches a terminal (where a control character is a keystroke) and Markdown (where brackets are links). Clean it once, at the boundary where it becomes something other than text.
- **A long-lived reader must re-read everything that can change**, not only the remote store. The registry, incidents included, changes while the editor is open; reading it once made the demo's last beat — the fixed break — invisible.
- **When two windows each show "the project", say which.** A view scoped by where it runs needs to name its scope, or a correct view reads as a broken one.

## What We'd Do Differently

- **Show the person the extension before falsifying.** Sandy's first look produced two promises and a reshaped panel; trying it before Build Phase 5 would have put that work before falsification and cleanup, not between them.
- **Time live checks from the event, and require evidence newer than the action, from the first draft** — both corrections came from reading results that looked fine.
- **Clean `dist/` before every build.** Not this plan's code, but found during it: version 1.67.0 ships 33 compiled files whose sources were deleted, among them a graph-tools module with a shell-injection flaw reported by a security researcher. It is unreachable since 1.33.1, and still published.

## Insights Worth Carrying Forward

- The pure-core / thin-adapter split paid for itself: every rule falsification hit was a unit test against the core, and the VS Code layer needed only the install contract and the live probe.
- A CLI line stream is a good boundary for an editor: one process per window, the package's own credential lookup, and no second reader.

## Shape

Shape raised **4** findings across eight build phases: the fix's source choice in the VS Code layer, a restart on window close, `fixAction` reassigning its parameter, and the panel's wiring inside `activate`. A person judged **0** of them wrong. Every other phase recorded "nothing to change".

## Retrospective Audit

- **Docs**: the guide, `reference/cli/promises.md`, `reference/cli/editor.md`, the admin overview and the changelog describe what was built, including the panel's grouping and the line's `runs` and `plan`.
- **Tests**: 31 trajectory rows, all passing; U1 (Cursor) recorded by a scripted run.
- **Quality**: no recurring lint or type errors suggesting a new Biome rule; the token-grammar trap is guarded by `indusk promises check`, which already runs in `pnpm test`.
