# Run a new scanner against the repository that documents it before its first phase closes — the file that describes a marker carries the marker

A check that scans source for a token (`promise: <name>` in day-promises) read its own docblock, a type annotation, a lockfile entry and a test's example string as citations the first time it ran against the repository that ships it — and again, after the rule was tightened, the comment that documents the tightening.

Why it matters: fixtures share the author's blind spots by construction. The repository that documents a marker is the one place guaranteed to spell it in prose, so it is the best negative corpus available and the last one an author thinks to try.

What to do: run the scanner against its own repository in the phase that ships it, not at close. Write the documenting comments and pages so they describe the marker without spelling it (`the token followed by the name`, `{ promise: <type> }`), and add a negative case per false positive found. When a rule has a "before" or "after" in it (a token must follow an opener), write down which of the two readings is meant and test the other — the first tightening refused a real comment with text before the token.
