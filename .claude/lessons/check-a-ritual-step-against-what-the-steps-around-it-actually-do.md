# A ritual step's logic must be checked against the steps immediately before and after it, not read in isolation — a correct-alone step can be silently defeated by what its neighbor commits

During release-ritual, retrospective Step 11 diffed `HEAD~1..HEAD` to detect "did this plan's landing produce a releasable change" — correct in isolation. But Step 10 (immediately before it) ends by committing the landing note as its own commit. So by the time Step 11 ran, `HEAD~1..HEAD` was always just Step 10's landing-note commit, never the actual landed merge — Step 11 would have read "nothing to release" for every single plan, permanently.

The root confusion: "the last commit is the landed merge" was assumed, but the actual last commit by the time a later step runs is whatever the step immediately before it committed — the landing note, not the merge.

Why it matters: a ritual (or any multi-step pipeline) step that reads recent git state (HEAD, HEAD~1, "the last commit") is implicitly coupled to every step that runs before it and might also commit. Reviewing or testing that step in isolation — with git state set up by hand rather than by actually running the full preceding sequence — will miss this class of bug, because the isolated test's "HEAD~1..HEAD" setup doesn't reproduce what the real pipeline leaves behind.

What to do instead: when a ritual/pipeline step's logic depends on relative git state (HEAD, "since the last X", "the most recent commit"), trace through what every step immediately before it actually commits, in the order they run — not just what that one step is supposed to see. Test it by running the full sequence, not by constructing a plausible-looking git state for that step alone.

See `.indusk/planning/release-ritual/` retrospective.
