# A hook that reads shell commands must be falsified against the spellings agents actually use — git options before the verb, a preceding cd, -c strings, -am, pathspecs — not the one the author types

The trunk guard's commit gate (trunk-guard, 2026-09-17) shipped reading exactly one spelling: `git commit` in command position, judged against the event's cwd, with `-a` only as a lone flag. Falsification found three holes, each a spelling an agent uses daily and each present in the same repository's git history from the same afternoon:

- `git -C <repo> commit`, `git -c k=v commit`, `git --no-pager commit` — options between `git` and the verb; and `cd <repo> && git commit`, which moves the repository out from under the cwd.
- `bash -c "git commit …"`, `sh -c '…'`, backticks — a commit inside a `-c` string or a substitution.
- `git commit -am …` and `git commit -m … <path>` — both commit files that were never staged, so "judge the index" missed them.

**Why it matters**: a guard's value is exactly the set of spellings it reads. A spelling outside the set is a hole that looks like protection.

**What to do**: before writing a regex over a shell command, read the last two days of `git log -p` (or the session transcript) for the shapes actually used and author them as red cases in Test Phase 1. Anchor on command position (start or after `; & | ( newline`, a backtick, or `-c "`), capture the tool's own pre-verb options so `-C`/`--git-dir` can move the judged root, track `cd` in earlier segments of the same command, tokenize the arguments with quote and escape awareness, and read flag clusters (`-am`) and pathspecs. Then write down, where the next reader will look, what the gate does NOT read (a script that commits inside itself), so "protected" is a claim with edges. Never String.includes; never a regex that requires the verb to be adjacent to the tool name.
