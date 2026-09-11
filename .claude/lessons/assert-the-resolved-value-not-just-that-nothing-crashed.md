# A test that only asserts a command exited 0 can be green while the thing it produced is silently wrong — assert the actual resolved value/state, not just the absence of a crash

`workbench restore`'s `linkTrunk` had two bugs sitting on the same code path: the parent directory of the symlink target was never created, and the relative symlink target was computed from the workbench root instead of the link's own directory — so on some layouts the link pointed at itself. A test asserting only "`restore` exits 0" would have been green through both bugs, because neither bug makes the command exit non-zero; both leave a symlink on disk that resolves to the wrong place (or a broken/self-referential place) while the process reports success.

The test that actually found both bugs (A22) asserted the specific outcome that mattered: that the link, once created, **resolves to the clone** — i.e. it read the symlink target back and checked it pointed at real content, not just that a file existed at the expected path.

**The general pattern:** "did the command crash" and "did the command produce the correct result" are different questions, and a test that only answers the first is exactly as blind as a check that only tests presence instead of capability (see `ask-what-a-check-proves`). This is especially easy to get wrong for operations whose failure mode is "silently constructs the wrong thing" rather than "throws" — file moves, symlinks, renames, config writes, anything where the operation can complete without error while producing output nobody asked for.

**How to apply:** for any operation under test, ask specifically: if this operation silently did the WRONG thing instead of the right thing, would this test still pass? If the test only checks exit code / no-throw / "a file exists at path X," the answer is often yes — extend the assertion to read back and verify the actual resolved state (the symlink target, the file's content, the config's parsed value), not just its presence or the process's exit code.

See `.indusk/planning/workbench-trust-fixes/` (A22, `linkTrunk`) for the concrete case.
