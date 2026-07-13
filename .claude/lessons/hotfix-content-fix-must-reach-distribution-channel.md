# A working-tree fix to distributed content (docs, published packages) isn't done until it's published

When fixing a bug in content that gets distributed through a separate channel — a published npm package, a deployed docs site, a CDN-served asset — a git commit to the source repo only fixes the working tree. It does NOT reach existing consumers until something publishes/deploys that channel.

Discovered during the `stale-indusk-docs-path` hotfix (2026-07-06): fixed 20 skill files referencing a renamed directory, shipped the PR, but falsification found the currently-published npm package (verified via `npm pack @infinitedusky/indusk-mcp@latest`) still shipped every one of the broken files — the fix hadn't reached the actual distribution channel anyone consumes. Same gap existed for the published VitePress docs site's reference pages.

What to do instead: for any fix to content that has a separate publish/deploy step from the git commit, explicitly ask "does this need to be published/deployed to take effect for actual consumers, not just merged?" as part of defining "done" — ideally at planning time, not discovered later via falsification. This generalizes beyond hotfixes to any bugfix touching a published package, a deployed site, or similar distributed artifact.
