# To falsify whether a check is correct, name the exact question it's supposed to answer and compare — a check can pass its own tests while answering a narrower question than intended

During release-ritual, three separate checks each passed their own unit tests while silently answering a narrower question than the one they were meant to answer:

1. A regex meant to validate "this commit's message" actually scanned over the whole command line (including unrelated flags/content), not just the message.
2. A check meant to cover "everything since the release" actually only diffed `HEAD~1..HEAD` — one commit, not the full range since the last release commit.
3. A check meant to verify "the install matches the lockfile" actually only checked one package's dependencies, not the whole workspace's.

Why it matters: a check's own test suite can be green forever while the check answers a different, smaller question than its name or purpose claims — because the test suite was written against the same narrow understanding as the implementation. Passing tests prove internal consistency, not that the check does the job it was built for.

What to do instead: when falsifying (or reviewing) a check, write down the exact question it is supposed to answer in plain language first, independent of the code. Then read the implementation and ask whether it actually answers that question, or a narrower/different one that happens to overlap in the common case. Look specifically for scope-narrowing: a regex that matches more or less than intended, a diff range that's shorter than "since X", a check that covers one case of a plural thing ("the dependencies" vs "a dependency").

See `.indusk/planning/release-ritual/` retrospective.
