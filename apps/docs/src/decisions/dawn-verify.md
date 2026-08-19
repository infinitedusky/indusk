# Dawn Verify — phase-boundary verification for work Dawn didn't execute

**Status:** accepted (2026-08-05) · Dawn component 6 — the keystone
**Full ADR:** `.indusk/planning/archive/dawn-verify/adr.md`

## What was decided

`atdawn verify <plan> --phase N` — a **read-only detector** that reconstructs a phase boundary from git and reports five ways the claimed state fails to match the actual state: premature checkoff, skipped test-first duty, goalpost drift, red tests, and phantom work.

Three of the five reuse existing machinery unchanged (`probePhaseClose`, `checkGoalposts`). Two are new — and one of them closes a gap far wider than the component's stated scope.

## The finding that reframed the component

The master motivated component 6 as enforcement for the enforcement ladder's third rung — work done where Dawn has no write-path seam to hook. Research turned up something broader:

> **Nothing in InDusk had ever executed a test as part of gate enforcement.**

`check-gates` reads the Test Trajectory's `State` column and trusts it. The goalpost guard explicitly permits `planned → written → passing` as honest progress. So `passing` — the system's core credibility artifact — was an unverified self-report in **every** lane, including the two Dawn controls. Verify is the first thing that checks it.

## Key decisions and their tradeoffs

**Detect and report; never repair.** Verify renders a verdict and exits. Reverting belongs to a later component, and inherits a constraint established the hard way during `dawn-hook-parity`'s falsification: `git reset` unstages but cannot un-write a working tree. What has been written can only be *accounted for*, not unwritten. A detector that reports is honest about that; a reverter would have to relitigate it.

**A chained ledger, not a pre-dispatch snapshot.** The baseline for phase N is the record a previous verification wrote; the first bootstraps from the merge base. The chain is a *byproduct* of verifying rather than a ceremony to remember — because a forgotten pre-dispatch snapshot would fail silently in exactly the case the command exists for.

Two failure-safety rules follow, and they are the **inverse** of the pending-eval ledger's. That one writes its marker *before* the risky operation so a crash leaves a gap rather than a double-eval. This one appends *only after* a clean verdict, because the danger here is a rejected phase silently becoming the yardstick for the next one. And a corrupt ledger **refuses loudly** rather than degrading into bootstrap mode — that failure would otherwise be indistinguishable from success.

**Runner-agnostic red-test attribution.** An optional trajectory `Test` column names test **files** (repo-root-relative); verify runs them through the project's own command and uses the **exit code** as the verdict. The more precise option — tagging test titles and parsing the runner's JSON — was rejected because it hardcodes tool knowledge into core, which extensions own. If file-level attribution proves too coarse, tags return as an extension capability, not here.

**Scoped to referenced files.** Cost scales with the phase, not the project (`--full-suite` opts in). The accepted consequence: **verify does not catch regressions outside referenced files.** That is the Tier-2 judgment-checker's job, deliberately assigned elsewhere rather than absorbed.

**Phantom work is deliberately narrow.** It fires only when a phase's diff touches nothing but the plan's own `impl.md`, and only counts *implementation* items. It misses a trivially-satisfied checkoff — accepted, because attributing an item to a hunk is not reliably possible and a detector that cries wolf gets disabled.

## The keystone verdict

Boundary verification **held**. A 6-cell acceptance matrix against a hookless `claude -p` session — hook files installed but *unregistered*, so nothing gated the agent while verify still had a real chain to probe — caught **5 of 5 planted violation classes with zero false positives** on an honest control run.

It is a **sample, not a proof** (recorded as deferred verification U1), and the carry-forward is wired into the roadmap: component 7 cannot close until it re-runs this matrix against a non-Claude agent.

The result picked component 7's branch: **integration over a proven command, not per-agent seam plumbing.**

## What the build taught

Falsification and dogfooding found nine defects after "impl complete", and they shared one shape — **verify lying in the confident direction**, asserting either a failure it never observed or cleanliness it never established. Two worth carrying:

- **A tool's own success artifact can disable it.** The ledger is tracked, so once committed it appeared in every later diff and made phantom's "nothing else changed" test permanently false.
- **Pointing the tool at itself is a distinct test class.** 33 passing tests and a real-agent experiment did not surface the monorepo path ambiguity; one real run did, immediately.

## See also

- [`atdawn verify` reference](../reference/cli/verify.md) — flags, detections, the ledger, exit codes
- [`atdawn run` reference](../reference/cli/run.md) — the controlled-lane counterpart
- [Dawn Verify lessons](../lessons/dawn-verify.md)
- [Dawn hook parity](./dawn-hook-parity.md) — component 2, whose A11 refutation constrains the no-repair decision

## Two roots, and a maintained refusal

*(versioned-workbench, 2026-08)*

`verify` originally assumed one repository: the plan and the code it describes
shared a root. A **workbench** breaks that assumption — `impl.md` lives in the
workbench's `.indusk/planning/`, while the code sits across a trunk symlink in
a wrapped repo with its own history.

That was survivable only by accident. A workbench root was deliberately *not* a
git repo, so `assertGitRepo` refused and no detector ever ran there. The
refusal held because of a property nobody maintained.

`versioned-workbench` makes the workbench root a git repo, which removes the
accident. What is left is a repository whose diff **structurally cannot contain
the code being judged**: phantom detection fires when nothing outside `impl.md`
changed, which in a workbench is always true. Every honest checkoff would be
reported as phantom — and a detector that cries wolf gets switched off, taking
its real catches with it.

So `verify/roots.ts` now maintains the refusal on purpose:

| Project shape | Behavior |
|---|---|
| Normal mode (`.indusk/` inside the code repo) | Unchanged. Plan root and code root are the same directory. |
| Workbench, no repos declared | Refuses — there is no code root to judge against. |
| Workbench, several repos | Refuses, **naming every candidate**. A verdict against the wrong repository is indistinguishable from a correct one. |
| Workbench, one repo | Refuses, explaining that the ledger's baseline sha comes from the plan repo and has no meaning in the code repo. |

**It never falls back to the plan root.** A diff of plan documents is not
evidence about code, and reporting it as such is exactly the "could not check"
reported as "checked" failure this command exists to prevent.

### What is deliberately not done

Resolving the code root's *path* is easy; the missing piece is a **baseline**.
The verify ledger records a sha from the plan repo, and that sha does not exist
in the code repo's history — so there is nothing honest to diff against. Making
verification work across two repositories requires the ledger to carry a
per-repo baseline, and that is a **named follow-on**, together with the
equivalent split for Shape and cleanup.

Refusing costs nothing that previously worked: a workbench root was not a git
repo, so every run already refused. What changed is that the refusal now says
why.
