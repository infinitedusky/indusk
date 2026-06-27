# Section shape: branch-mergeable markdown + the lock-vs-merge split

Insights surfaced during the `handoff-multi-agent-section-shape` plan (shipped 1.30.0). The plan reshaped `.indusk/current.md` from fixed sections + separate presence files to per-agent sections in one file. Three lessons generalize beyond this specific plan.

## 1. `merge=union` + content-shape parser cooperation is the canonical pattern for append-only markdown

If you want a markdown file where different actors append their own blocks on different branches and merges combine all of them, **two coordinated changes are required**. Neither alone works.

**The `.gitattributes` driver:**

```
# Combine line additions from both sides instead of conflicting on same-end-of-file inserts
.indusk/current.md merge=union
```

`merge=union` tells git's auto-merge to combine both sides' line additions instead of treating them as a conflict. Without it, two branches appending different blocks at the same end-of-file position produce a "same insertion point" merge conflict — even though the appended content is semantically independent.

**The parser's multi-block recovery:**

```ts
// In parseCurrentMd:
if (block.match(/^##\s+Session\s+/m)) {
  // A delimiter-split block may contain MULTIPLE `## Session` headings when
  // git's merge=union driver combined two branches' appends and deduplicated
  // the trailing `---` separators. Split on `## Session` boundaries before
  // parsing so each session is recognized independently.
  const sessionSubBlocks = block.split(/^(?=##\s+Session\s+)/m);
  for (const sub of sessionSubBlocks) {
    if (sub.match(/^##\s+Session\s+/m)) {
      const section = parseSessionSection(sub);
      if (section) sections.push(section);
    }
  }
}
```

Why this is required: `merge=union` deduplicates lines that appear identically on both sides. When two branches each append `## Session A — ...\n...\n---` and `## Session B — ...\n...\n---`, the trailing `---` is identical on both sides, so the union driver collapses them into one. The result has Session A's content followed immediately by Session B's content, with only one trailing `---`. A naive parser that splits on `---` first will treat both sessions as one delimited block; the multi-block recovery rescues them.

**Use this pattern when:**
- Different agents (humans or programs) need to append their own blocks to a shared markdown file
- The file is tracked in git and edits arrive via PRs/merges
- Append-only is the dominant access pattern; co-edits of the same block are rare enough that a normal merge conflict on those is acceptable

## 2. Workbench mode shifts the concurrency primitive from git to filesystem locks

A claim like "git mediates concurrency" is mode-dependent. Two modes you'll typically have:

**Single-repo mode** — the file lives inside a git repo. Two agents on different branches editing different sections rely on `merge=union` + the parser's multi-block split. Git is doing the concurrency work.

**Workbench mode** — the file lives at a workbench root that wraps a canonical clone via symlink. The workbench root is NOT a git repo (the wrapped repo and its worktrees are). Two agents on different worktrees writing the file concurrently are doing concurrent filesystem writes to the same path — git's merge resolution is not involved. The atomic-rename pattern protects against torn-write reads but does NOT serialize read-modify-write: process A reads, process B reads, A writes-renames, B writes-renames over A's content with B's stale-of-A's-write computation. One section is lost.

The fix: an `O_EXCL`-based file lock on `<workbenchRoot>/.indusk/current.md.lock`, held around every read-modify-write of the file. This is the LOAD-BEARING concurrency primitive in workbench mode.

**Implications for design:**

- When you write an ADR claiming "git handles concurrency," check whether your project might also run in a workbench / wrapped-repo mode. If it does, the claim is mode-dependent.
- When you ship a concurrency-sensitive file, ship the file lock alongside the file format. The two are not independent design decisions.
- The file lock is also useful in single-repo mode (protects against two CLI invocations in the same worktree racing on the file). The single-repo case happens to also have git as a safety net; the workbench case doesn't.

## 3. "Atomic rename" misleads when documented without distinguishing the two guarantees

The atomic-rename pattern (write to `path.tmp`, then `rename(path.tmp, path)`) protects against torn-write reads — a reader of `path` never sees a half-written file. The `rename` syscall is atomic on POSIX filesystems; the file's contents flip from old to new instantaneously from a reader's perspective.

This is NOT the same as serializing read-modify-write. Two writers can both:

1. Read the current contents of `path`.
2. Compute different mutations from the same starting state.
3. Each write their own `path.tmp.<id>` file.
4. Each `rename` over `path`.

Whichever writer renames last wins; the loser's mutation is gone, despite both writers having executed the atomic-rename pattern correctly.

**Practical takeaway:** when documenting concurrency primitives, name the GUARANTEES, not just the technique. "Atomic rename prevents torn-write reads; serialization of read-then-write requires a separate lock" is the honest description. "Atomic write" without that distinction implies guarantees the technique doesn't deliver.

## What we'd do differently next time

- **Run falsification on the parent plan too.** The four Phase 6 hypotheses all applied to the original `handoff-multi-agent` shape in equivalent forms. Running `/falsify` on the parent plan before the section-shape rework might have surfaced them, possibly even informing the parent's design before the rework was needed.

- **Phase 0 trajectory tests as real-failing tests, not `.skip()` scaffolds.** The `.skip()` shortcut from the parent plan made the section-shape plan move faster but hid the gap that falsification later found — T14's body-injection vulnerability was writable as a real-red test on day one of Phase 1. Strict tests-first discipline catches what `.skip()` scaffolds defer.

## See also

- [Multi-Agent Coordination ADR](/decisions/multi-agent-coordination) — the architectural rationale (with supersession banner)
- [Multi-Agent guide](/guide/multi-agent) — user-facing flows; "Concurrency in workbench mode" section explains the mode split
- [`indusk agent` CLI reference](/reference/cli/agent) — the four subcommands
- [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools) — the MCP write surface (with sanitization rules)
- [Falsification Ritual guide](/guide/falsification-ritual) — the discipline that surfaced these lessons
