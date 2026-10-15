# A cache keyed on a directory's mtime misses an in-place file edit — key on the files' own mtimes (or the git HEAD) and test an edit inside a folder

A directory's mtime changes when entries are added, removed or renamed in it, not when a file inside is rewritten. A cache that keys on folder mtimes serves old text after an in-place edit.

Why: brief-as-the-contract's performance fix cached the archived-plans read (2.1 s, twice per page) on the archive's and each folder's mtime; falsification row A29 showed an edited archived plan was served stale. The fix keys on the newest mtime of the folder and its files two levels down (`newestMtime` in `apps/indusk-admin/src/lib/planning-reader.ts`). Nested files one level deeper still need their own mtimes.

How to apply: when caching a read of a directory tree, include the files that feed the result in the key, or key on a content hash / git HEAD; add a test that rewrites a file in place and expects a fresh read (`planning-reader.archive-cache.test.ts` is the pattern).
