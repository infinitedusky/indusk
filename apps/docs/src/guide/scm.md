# Source Control: jj or git

InDusk supports two source control systems: [Jujutsu](https://github.com/jj-vcs/jj) (jj) and plain git. The right one for your project depends on your team's existing workflow — InDusk works either way, but the per-item commit ritual diverges in a meaningful way that's worth understanding.

## Detection at init

`indusk init` detects which SCM your project uses at scaffold time:

1. **Tries `jj log -r @` first.** If your repo has a colocated `.jj/` directory (jj overlaid on top of git, jj's normal mode of operation), jj wins.
2. **Falls back to `git rev-parse HEAD`.** Plain-git repos take this branch.
3. **Defers if neither succeeds.** A bare tmpdir with no SCM gets an `scm`-free config; the next `indusk update` (after you run `git init` / `jj git init`) populates the field. **Init prints a loud stderr `⚠ WARNING` when this happens**, naming the recovery command so you don't silently fall through to the default — without the warning, `getScm()` quietly defaults to `"jj"` and you may not notice until the eval hook starts telling Claude to run `jj diff` on what's actually a git project. After running `git init` (or `jj git init`), run `indusk update` and the warning goes away.

The result is written to `.indusk/config.json`:

```json
{
  "scm": "jj"   // or "git"
}
```

This is the runtime source of truth. Read it via `getScm(projectRoot)` from `apps/indusk-mcp/src/lib/scm/detect.ts`.

## The Two Rituals

The high-level commit cadence is the same — **one commit per checklist item**, eval hook fires on each commit. The difference is *timing*.

### jj — describe-then-do

```
jj new                                 # fresh empty commit
jj describe -m "what I'm about to do"  # state intent BEFORE work
[do the work]
[check item off in impl.md]
→ repeat
```

The eval agent fires on `jj describe` and scores the work in the context of stated intent. See [`apps/indusk-mcp/skills/jj.md`](https://github.com/your-org/indusk-mcp/blob/main/apps/indusk-mcp/skills/jj.md) for the full skill.

### git — do-then-commit on a feature branch

```
git checkout -b plan/my-plan-phase-1   # short-lived feature branch
[do the work]
[check item off in impl.md]
git add -p                              # selective staging
git commit -m "context: what + why"    # commit AFTER work
→ repeat

# at phase / plan completion:
git push -u origin plan/my-plan-phase-1
git merge → main
git branch -d / git push origin --delete   # delete local + remote
```

The eval agent fires on `git commit` and scores the work after the fact. The judge has the diff + transcript but no pre-stated intent. See [`apps/indusk-mcp/skills/git.md`](https://github.com/your-org/indusk-mcp/blob/main/apps/indusk-mcp/skills/git.md) for the full skill — including trunk-based development discipline, branch hygiene, and recovery procedures.

## Asymmetries to Know About

| Aspect | jj | git |
|--------|----|----|
| Commit description timing | Before the work | After the work |
| Eval context | Diff + transcript + stated intent | Diff + transcript only |
| Branch model | One linear stack with rebase/split/squash as normal ops | Short-lived feature branches off main |
| History rewriting | Routine | Allowed on local branches; never on shared/published |
| Staging area | None — working copy IS the change | `git add -p` for selective staging |
| Semantic graph | Full support — change IDs survive rebase/amend | **Graceful-degrade** — `indusk graph sync` no-ops; full git parity is future work |

## Semantic graph caveat for git users

The semantic graph (`indusk graph sync`, Graphiti log capture) is jj-only in v1. On git-mode projects:

- `indusk graph sync` exits 0 with a clear `git mode — semantic graph unavailable` message.
- `indusk graph status` and `indusk graph rebuild` early-return with the same message — none of the three commands reach their jj-specific code paths on git projects.
- The MCP tools `mcp__indusk__graph_sync`, `mcp__indusk__graph_rebuild`, `mcp__indusk__graph_status` return the same human-readable text instead of jj-flavored errors, so an agent inspecting these tools knows to skip semantic graph operations on git projects.
- `captureWithLog()` warns once per session and skips the event-log mirror; Graphiti writes still succeed.
- All other features — plans, lessons, eval, highlights, init/update — work on git unchanged.

This deferral is deliberate. The semantic graph event log uses jj change IDs because they survive rebase/amend/split; git commit SHAs don't. Full git parity (a stable `event_id` UUID independent of SCM) is queued as a follow-up plan. See [`.indusk/planning/git-or-jj-substrate/research.md`](https://github.com/your-org/indusk-mcp/blob/main/.indusk/planning/git-or-jj-substrate/research.md) "Three viable degrade modes" for the design rationale.

## Choosing Between Them

If you're already using jj — keep using jj. The describe-then-do flow is genuinely better for agent-driven work, and the semantic graph is a real feature.

If you're new to SCMs or your team is on git — use git. Trunk-based development with short-lived feature branches is the standard big-org workflow; InDusk's `git.md` skill describes that pattern. You don't need to learn jj just to use InDusk. The semantic graph deferral is the only feature gap.

If you want to try jj on top of an existing git repo — run `jj git init` in the project root. jj colocates its own `.jj/` alongside `.git/`. From then on, `getScm()` returns `"jj"` because `jj log -r @` succeeds. Your team can keep using git; you can use jj locally.

## Migrating Between Modes

If your project's `.indusk/config.json` is missing the `scm` field (pre-1.28.x scaffold), running `indusk update` detects and writes it.

If you switch SCMs (rare — typically adopting jj on top of an existing git repo), hand-edit `.indusk/config.json`'s `scm` field. There's no CLI affordance because the change is rare and deliberate.
