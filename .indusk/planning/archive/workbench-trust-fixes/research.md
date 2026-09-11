---
title: "Workbench Trust Fixes — Research"
date: 2026-09-03
status: complete
---

# Workbench Trust Fixes — Research

## Question

Versioned-workbench (1.37.0–1.40.3) made the workbench root a git repo and the
repo/worktree layout config-declared (`worktree.repos[]`, per-repo `path` /
`worktrees`, `repos_root`). The epic systematically taught its own surfaces the
new shape (health `ba7e1c67`, doppler `307960dc`, init-docs, the update nudge
`6ba1469e`, bash provisioning `53873183`, wt slug resolution `0ceada8a`, trunk
routing in 1.42.0). **Which surfaces did it not reach, and what do they do
wrong there now?** Audited 2026-09-03: three targeted audits (verify lane, run
lane, eval/coordination rail) plus a full sweep classifying every consumer of
the declared layout.

## Findings

### F1 — `atdawn run` mis-executes silently in a workbench (worst)

- Its only topology guard — commit-cadence disabling itself when the root is
  not a git repo (`lib/run/commit-cadence.ts:113-119`) — became unreachable
  when roots became git repos. Cadence arms, commits impl checkoffs/plan docs
  to the **workbench** repo (`commit-cadence.ts:154-157`, cwd = root), records
  the sha, feeds the pending-eval queue (`loop.ts:205-213`), and reports green
  per-item commits (`loop.ts:317`) — while the code the items claim is either
  uncommitted in another repo or was never writable.
- The code is unreachable by construction: one `root` at `loop.ts:188`; every
  tool path confined by `worktree-paths.ts:27-31` + `bash-gate.ts:51-56`.
  Sibling `repos_root`: every code edit refused as a path escape. Nested
  (`repos_root: "."`): edits land in a directory the workbench gitignores
  (`worktree/shareable.ts:118-127`).
- No refusal or warning at entry (`bin/commands/run.ts:45-107`); zero imports
  of `worktree/repos.js` anywhere under `src/lib/run/`.
- Prior art for the fix: `lib/verify/roots.ts:44-92` (`resolveVerifyRoots`),
  wired at `verify.ts:95-96` — the maintained refusal `run` lacks.

### F2 — the eval rail mis-attributes instead of refusing

- `hooks/_hook-paths.js:76-95` (`findGitPathFromCwd`) now succeeds at a
  versioned root, so the multi-repo refusal (`:145`, `declared.length !== 1 →
  null`) is dead code in the shape it was written for. Commits made from a
  session whose cwd is the workbench root are attributed to the workbench
  repo's HEAD — the "confident wrong answer" the docblock (`:118-123`) forbids.
- `declaredReposAt` (`_hook-paths.js:199`) — the refusal's naming mitigation —
  has zero consumers.
- `_hook-paths.js:146` resolves the fallback by `resolve(statePath,
  declared[0])` — name-at-root; a declared `path` makes it null (fail-closed,
  but dark: `system.log` only).
- Root commits of plan docs DO fire the hook and get scored against a code
  rubric; `workbench sync`'s own commits never fire it (execFileSync, not a
  Bash tool call) — probably desirable, recorded nowhere.

### F3 — the cleanup ritual is vacuous and silent at a workbench root

- `lib/cleanup/oversized.ts:104-114` guards only on "is a git repo" — which a
  versioned root now is. The diff it then examines covers `.claude/` +
  root files, never code (repos are gitignored). Returns `[]` as
  checked-and-clean. Same accident as verify's; verify was remediated
  (`verify/git.ts:29-36` — "the refusal is now MAINTAINED"), cleanup was not.
  The lesson `a-refusal-that-holds-by-accident-is-not-a-guarantee` names both.

### F4 — `workbench restore` is destructive under a declared `path`

- `bin/commands/workbench.ts:238` clones at `<repos_root>/<name>` while
  health/status/doppler/update-nudge all read `<repos_root>/<repoDir(r)>`.
  On a workbench declaring `path`: update reports the repo unmaterialized →
  tells the operator to run restore → restore clones a **second copy** at the
  name and links the trunk at it. The `path` half was fixed in the link calls
  (`:247`, `:287`) but not the clone target. `:225` prints a path it did not
  use.

### F5 — bash worktree lane: three siblings never got the wt.sh fix

- `setup-worktree.sh:63,69` and `refresh-worktree.sh:38-39` build
  `CLIENT_ROOT="$repos_root/$REPO"` by name — `worktree create`/`refresh` fail
  outright on a declared `path`; neither calls `_wt_resolve_trunk_dir`
  (`workbench-helpers.sh:289-310`, the canonical model since 1.42.0).
- `refresh-worktree.sh:184` (`--all`) and `:189` (single) scan the workbench
  root only — worktrees in declared `worktrees/` dirs are invisible to
  refresh. `preflight.sh:80` same, plus its private reserved list (`:71-76`)
  drifted (missing `docs`).
- `preflight.sh:65,85` excludes the trunk by `name ==` — misses a trunk at a
  declared `path`.

### F6 — silent-degradation tier

- `stray-state-audit.ts:62` — `join(workbenchRoot, repo.name)`: audits a
  directory that does not exist under a declared `path`, reports clean.
- `verify/roots.ts:90` — refusal message tells the user to run verify at
  `join(planRoot, declared)`, a path that does not exist on nested/sibling
  layouts.
- `isWorkbench` gates on `worktree.shape === "workbench"` only — a config
  declaring `repos[]` without `shape` slips past verify's refusal and verifies
  the wrapper repo. The refusal itself has **zero test coverage**.
- `worktree` post_create uses repo-0's config for every repo in multi-repo
  (`worktree.ts:218-220`).
- `indusk init` cannot author the declared shape at all (`init.ts:523,
  1274-1282` writes only `wrapped_repo` + `sibling_parent`) — `repos[]` /
  `path` / `worktrees` / `repos_root` are hand-written-only.

### F7 — the record contradicts itself

- CLAUDE.md asserts both "the workbench root is a git repo with its own
  remote" (versioned-workbench entry) and "the workbench root is deliberately
  not a git repo" (multi-agent coordination, agent-list, cleanup gotchas).
- Docs still carrying the dead invariant: `guide/multi-agent.md:160` (the
  sharpest — "merge=union is unwired here", directly negated by
  `shareable.ts:154-156`), `guide/worktree-setup.md:90`,
  `reference/cli/setup.md:22,50,57`, `reference/cli/agent.md:73`,
  `reference/cli/verify.md:166` (stale reason, correct behavior),
  `guide/rail-check.md:130`, `skills/cleanup.md:42` (both halves false).
  Code comments: `_hook-paths.js:7,228-234`; `eval-trigger.js:197,397`;
  `oversized.ts:104-107`.
- Dawn master (`indusk-v2-dawn/master.md`): "5 hooks on disk, not 6" (there
  are 6 — `workbench-sync.js` landed 1.37.0, `ec18fa6b`, and appears in no
  keep/shed record); "component 6's verify … runs on every tier" (it refuses
  in every workbench); the word "workbench" appears zero times.
- `guide/index.md:59` — header says four hooks, its own table lists five.

### F8 — workbench-mode-rail-integrity is unrunnable as written

- `impl.md` frontmatter `in-progress`; Phases 1–5 unchecked despite master.md
  recording "Phase 1-4 shipped 1.31.7"; the U1 backfill blocker's acceptance
  criterion is `mcp__graphiti__get_episodes` — a tool deleted by
  indusk-makeover. H2's premise ("the workbench root, which is NOT a git
  repo") is false since 1.37.0; the "explicit skip is correct behavior" defer
  is now wrong-headed (the failure mode moved from skip to mis-attribution —
  see F2). `hook-paths.test.ts` has no fixture with a git-initialized
  workbench root, so the regression net cannot see F2.

### F9 — `gate-reminder.js` has never delivered a nudge (not workbench-specific)

Found 2026-09-03 while reading the hook for an unrelated reason. Same class as
F1–F4 — a mechanism that reports the reassuring case while doing nothing — but
it fails in **every** project shape, not just workbenches.

- Registered `PostToolUse` / `Edit|Write` (`.claude/settings.json:277`,
  `init.ts:1074`), fast-path exits unless the edited file is an `impl.md`
  (`gate-reminder.js:23`), so it engages only on checklist edits.
- Every message goes to `console.error`; **every exit path is
  `process.exit(0)`** (`:24, :32, :112, :142`). For a PostToolUse hook,
  stderr at exit 0 reaches the debug log only — never the model. Reaching the
  model requires exit 2, or JSON on stdout carrying
  `hookSpecificOutput.additionalContext`.
- The original commit (`c6b55205`) emitted a JSON envelope with **only**
  `hookEventName` — no message field — so that channel never carried the text
  either. `2a822001` ("biome: auto-fix formatting + lint hygiene", 32 files)
  deleted the `console.log` under `suspicious/noConsole` and renamed the
  variable to `_result` to silence the resulting unused-variable error. The
  underscore marks a lint suppression, not a design decision.
- The file's own docblock says it "outputs a reminder message that appears in
  the conversation as additional context" — describing `additionalContext`,
  the exact missing field. The comment has been accurate about intent and
  wrong about behavior for the hook's whole life.
- **Two orphaned halves of one feature**: `writableAtNudge` is defined inside
  `gate-reminder.js:214` and called only there; `getPhaseStartNudge`
  (`src/lib/trajectory/state-ops.ts:129`) is exported with zero production
  callers. Same shape as F2's `declaredReposAt`.
- **Why it matters now**: Gate A's `===` bug meant test-first was unenforced
  for 260 of 444 rows until test-phase-structure fixed it to `<=`
  (`check-gates.js:340-345`) on 2026-08-12. Enforcement went from off to on;
  the advisory half has been off the entire time. `falsify-phase-authoring`
  and `local-telemetry` are parked as "rows never authored" — the exact
  failure the nudge exists to pre-empt.
- **Fix trap**: `noConsole` allows `["warn", "error", "info"]` and no hook uses
  `console.log` today — the rule swept them all. `console.info` writes to
  stdout in Node and is on the allowlist, so it satisfies both the hook
  contract and the linter. A naive `console.log` fix gets deleted again.

## Open Questions

- Is `workbench-sync.js` an invariant (thin lane must enforce) or a procedure
  (shed)? Leaning shed-procedure — it is cadence, not a gate — but the
  keep/shed record must say so either way.
- Should `indusk init` learn to author `repos[]`/`repos_root` (feature-sized;
  candidate for workbench-code-roots' orbit) or stay hand-written?

## Sources

- Audits run 2026-09-03 against HEAD `171d14df` (three targeted + one sweep;
  findings preserved here with file:line refs).
- Commit range `f5297f99` (1.37.0) → `171d14df` (1.42.0).
- `.indusk/planning/workbench-code-roots/brief.md` — the live follow-on for
  "where is code inside the repo"; deliberately does not cover any of the
  above.
- `.indusk/planning/archive/versioned-workbench/` + `/decisions/dawn-verify`
  (the maintained-refusal prior art).
