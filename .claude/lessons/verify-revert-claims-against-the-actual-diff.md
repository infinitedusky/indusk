# Before writing "reverted X" or "fixed X" in a commit message, `git show`/`git diff` the specific file to confirm it's actually in the diff — a claimed revert that never touched the file is a false claim that survives until someone else greps for it

A commit message that says "reverted that edit" or "fixed X" is a factual claim about the diff, not a description of intent. If the file in question doesn't actually appear in `git show <sha> -- <file>`, the claim is false regardless of how confidently it's worded — and unlike a wrong number in a note, a false "I fixed it" claim actively suppresses re-checking, because the next reader trusts the commit message instead of the diff.

Seen in dusk (lifecycle-rebalance, three commits in sequence):
1. `dfe608b1` added a `/guide/shape` sidebar entry to `apps/docs/.vitepress/config.ts` — the stale, unserved scaffold config — and reported the sidebar fixed.
2. `6883e361` correctly identified the real config is `apps/docs/src/.vitepress/config.ts` and added the entry there, but its commit message also claimed "Reverted that edit" (the scaffold edit). `git show 6883e361 -- apps/docs/.vitepress/config.ts` is empty — the scaffold file was never touched. The dead entry sat there for one more commit, "reading as registered to anyone grepping for it" (3055c42f's own words).
3. `3055c42f` finally removed the dead scaffold entry, three commits after it was first introduced and one commit after it was falsely claimed fixed.

This is the same failure shape repeated: `verify-revert-claims-against-the-actual-diff` is one instance of a broader pattern where this agent has, across a single session, stated specific factual claims (an extension count, a lesson's name, a revert) with more confidence than the diff or the filesystem actually supports. `git show <sha> -- <path>` on every file a commit message claims to touch is a 5-second check that would have caught this at write time.

Companion to `vitepress-config-is-under-src-not-docs-root` (that lesson is about which file is live; this one is about verifying a commit's own claims against its own diff before writing them).
