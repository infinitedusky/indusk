# Claude Code discovers skills per project — a skill on a branch cannot be routed to from a worktree, so plain-language invocation checks run on the trunk after merge

writing-skill's dogfood rows asked a fresh context to say "let's work on the grift paper" and to invoke `/write` on the Day folder, from the plan worktree. Both contexts reported the skill was not in their Skill listing, because `.claude/skills/write/` existed only in the worktree; the session's skill index comes from the trunk project. One context found and chose the skill by grep and followed its file verbatim, which proved the instructions but said nothing about routing.

Why: skill discovery keys on the session's project root, not on a subagent's working directory. A branch-only skill is invisible to the Skill tool until it lands on the trunk.

How to apply: when a plan adds a skill, write its plain-language invocation row as a post-merge check from the start (`Passes at` a follow-on, or marked skipped with the reason until merge), and run it in a fresh trunk session. Do not spend a manual row on it from the worktree; the answer is structurally "not observable here".
