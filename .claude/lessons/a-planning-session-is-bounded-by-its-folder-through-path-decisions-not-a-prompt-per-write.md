# A planning session's boundary is its folder, decided in code on the path of each request — accept edits inside it unasked, forward only a path outside; never `bypassPermissions` to cut prompts

The person's goal was fewer accept/deny prompts; `bypassPermissions` delivers that by removing the boundary, and it let a draft's agent write into the repository, which breaks `a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`. "Fewer prompts needs bypass" was wrong: a path boundary gives both.

Why: brief-as-the-contract (2026-10-13). Sandy asked for bypass after prompt fatigue; the falsification phase (A26) showed the leak. Landed: `buildArgs` runs `acceptEdits` for both kinds and `SessionManager.start` decides a planning session's permission events with `decideBuildPermission` over `[cwd, ...addDirs]` (inside or pathless allowed silently, outside forwarded to the person). See `.indusk/planning/brief-as-the-contract/impl.md` Build Phase 6 and the retrospective.

How to apply: give a session the least permissive mode that does not prompt for its own work, and decide the rest in code. Known limit: a tool given no path (Bash) is allowed unasked, so a shell write outside the folder is not stopped by this boundary; do not claim it is a sandbox.
