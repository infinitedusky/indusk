# Jj Dependency (Historical)

> **Historical reference.** This page describes the original jj-only versioning design of the semantic graph bridge. As of 1.31.0 ([`git-only-substrate`](/decisions/git-only-substrate)), the semantic graph is git-only — the jj dependency is gone, and rebase tolerance comes via content-keyed dedup at sync time (`(path, blob_hash)` lookup) instead of stable change IDs. Provenance traceability is fuzzy (an event's `change_id` may name a rewritten commit) but functional correctness holds. The content below is preserved as a time-stamped record of the original design rationale.

The semantic graph bridge requires [jj (Jujutsu)](https://martinvonz.github.io/jj/latest/) as its versioning substrate. Projects that don't use jj cannot use the bridge in v1.

## Why jj, not git

The event log tags every event with the change ID active when it was written. Replay filters events by ancestry of the current HEAD. For this to work across branches, rebase, and amend, the time axis needs **stable identifiers** — IDs that survive history rewrites.

**Git commit SHAs don't survive history rewrites.**

| Operation | Git commit SHA | Jj change ID |
|---|---|---|
| `git commit --amend` / `jj describe` | New SHA | Same change ID |
| `git rebase -i` / `jj rebase` | New SHA per commit | Same change IDs |
| `git commit --fixup` + `squash` | New SHA | Same change ID |
| Abandon a branch | Dangling (gc'd eventually) | Unreachable (recoverable via `jj op log`) |
| Split a commit | Loses history | Same change ID plus new IDs for the splits |

Every git-SHA-based tag would orphan the moment you rebased. Jj change IDs are the correct primitive for this problem.

## What happens if jj is missing

The module exports a typed error:

```typescript
import { NotAJjRepoError, getCurrentChangeId } from "@infinitedusky/indusk-mcp/semantic-graph";

try {
  await getCurrentChangeId(projectRoot);
} catch (err) {
  if (err instanceof NotAJjRepoError) {
    // v1 behavior: fail hard — the bridge cannot operate without jj
  }
  throw err;
}
```

Both `getCurrentChangeId` and `getReachableChangeIds` throw `NotAJjRepoError` when:

- `jj` is not on `PATH` (ENOENT from `execFile`)
- The cwd is not inside a jj workspace (non-zero exit from `jj log`)

The sync pipeline treats this as a fatal error rather than silently degrading. Fallbacks would produce a semantic graph with fragile identity that breaks the moment anyone rebases, which is worse than no graph at all.

## Future: git-only fallback

A future plan could add a git-only fallback that assigns synthetic stable IDs from content hashes (e.g. `sha256(normalized-diff-body)`) so non-jj projects get some rebase resilience. This is explicitly out of scope for v1 — the InDusk ecosystem standardizes on jj, and adding a fallback now would double the surface area before the v1 pipeline has proven itself.

## Commands used internally

The jj module uses exactly two jj invocations:

| Purpose | Command |
|---|---|
| Current working-copy change ID | `jj log -r @ --no-graph --template 'change_id'` |
| Reachable ancestry | `jj log -r '::@' --no-graph --template 'change_id ++ "\n"'` |

Both are read-only — the bridge never mutates jj state. Implementation at [`apps/indusk-mcp/src/lib/semantic-graph/jj.ts`](../../../../apps/indusk-mcp/src/lib/semantic-graph/jj.ts).
