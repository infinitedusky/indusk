# Scope `biome check --write` to the files you changed — running it over whole directories reformats unrelated files under whatever config governs that directory

During day-monitor, two `biome check --write` runs over whole directories had side effects outside the intended change: one reflowed an unrelated 1,456-line fixture file, another reformatted an admin file using the root Biome config's tabs instead of the admin app's own 2-space config. Both had to be undone later (the fixture at cleanup phase).

Why it happens: `biome check --write <directory>` walks and rewrites every matching file under that path, including ones you didn't touch, and applies whatever config resolves for that path — which may not be the config you meant if directory boundaries cross app-specific overrides.

What to do instead: scope biome to the specific files changed in the current phase/commit (`biome check --write <file1> <file2> ...`), not a directory glob, unless a directory-wide reformat is the deliberate intent of the change.
