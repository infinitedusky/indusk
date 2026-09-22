# Scope `biome check --write` (and any auto-formatter) to the files you changed, never a whole directory

During day-monitor, two `biome check --write` runs over whole directories reformatted files the plan never touched: a 1,456-line fixture and an admin file that picked up the root biome config's tabs instead of the admin's own 2-space setting. Both had to be undone later — the fixture at cleanup, costing a full pass to find and revert unrelated diff noise.

Why it matters: a directory-scoped formatter run silently rewrites every file biome considers stale or misconfigured in that tree, not just the ones the current phase touched. In a monorepo with per-package config overrides (root vs. admin's 2-space), a directory run can also apply the wrong config to a subtree.

What to do instead: pass the specific changed file paths to `biome check --write`, not a directory glob. If a directory-wide reformat is genuinely intended, do it as its own isolated commit so it's reviewable and revertible independent of the plan's actual changes.
