# `cmd | head` reports head's exit status, not cmd's — a correctly-failing command reads as exit 0 through the pipe

Found during versioned-workbench Build Phase 3 (commit d3d2b166): `indusk workbench restore | head` was used to sanity-check a restore against the real avoca workbench. The restore was correctly failing (non-zero, per A12's partial-failure contract), but the shell reported `$?` as 0 — because in a pipeline, `$?` reflects the LAST command's exit status by default, and `head` exits 0 whether or not the thing feeding it succeeded. The commit confirmed the real exit code was 1 by running the command directly (or checking `PIPESTATUS`), not through the pipe.

## Why

Any `cmd | head`, `cmd | tail`, `cmd | grep`, or similar truncates/filters output AND silently discards the upstream exit status unless the shell is told to preserve it. A person reading `$?` after such a pipeline is reading the wrong command's verdict — and because the output still *looks* plausible (truncated but present), there's no visual cue that the exit code is meaningless.

## How to apply

When checking whether a command succeeded or failed, never pipe it through a truncating/filtering command and then read `$?`. Either: run the command directly and pipe its saved output to a viewer afterward (`out=$(cmd); echo "$out" | head; echo "exit: $?"` — captured before the pipe), use `set -o pipefail` so a failing upstream command fails the whole pipeline, or inspect bash's `${PIPESTATUS[@]}` array for the individual per-stage exit codes. This is especially load-bearing when verifying a partial-failure contract (like `indusk workbench restore`'s non-zero-on-incomplete guarantee) — the exact case where a passing check masking a real failure would be worst.

