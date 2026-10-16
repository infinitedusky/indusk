# A stored value changes reader-first, writers a release later

When renaming a value that a program reads — a telemetry attribute value, a JSON field another tool parses, a state written into files — and any reader ships separately from the writer (a deployed server, an installed editor extension, an older CLI on another checkout), do not switch reader and writer in one release. Teach every reader both the old and new value first (one reading function, e.g. `readOutcome`), keep writers on the old value, and switch writers in the next release.

Why: in one-promise-language (2026-10-15) the signal outcome `violated` → `broken` would have made every recording server older than the plan drop the signal (the promise goes dark). The ADR held that line for the signal attribute but missed a second wire: `indusk promises health --json`, read by the installed VS Code extension, which `indusk update` never refreshes — an old editor read every `broken` run as *held*. A fresh review found it, not the ADR.

How to apply: in research, list EVERY machine reader of EVERY value you change (attributes, CLI `--json` output, registry/file states), and for each ask "can this reader be older than the writer?" If yes, reader-first. Words people read can change in one step; values programs read cannot.
