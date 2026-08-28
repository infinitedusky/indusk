# When a feature converts A to B, the fixture must start at A

A migration's whole purpose is to handle the *old* shape, which makes the old shape the input most likely to go untested — the author builds fixtures in the shape they are currently thinking in, which is the new one.

Two defects in `versioned-workbench` shipped this way:

- `workbench migrate-layout` moves a flat workbench's worktrees and then records where they went. The recording step read `cfg.worktree.repos`, a key the *legacy* config does not have. Every fixture used the modern plural shape, so the moves were tested and the recording was not — on exactly the workbenches the migration exists for. The layout silently undid itself on the next `worktree create`.
- `wt.sh` had to serve *declared* worktree layouts and every one of its tests used the flat root, so a worktree in a declared directory was invisible rather than ambiguous. Declared layouts had shipped a release earlier with the execution surface unaware of them.

**The rule:** when a feature's purpose is "convert X to Y" or "support both X and Y", at least one fixture must be built at X. A suite made entirely of Y proves the feature works for inputs that never needed it.

This is the same structural failure as an audit scoped to the wrong directory: the test and the code share an author, so they share a blind spot. The check is not "are there tests" but "does any test start from the state this code was written to rescue?"
