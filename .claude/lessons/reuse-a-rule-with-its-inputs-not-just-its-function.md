# Reuse a shared rule together with the inputs that choose it, not just its function — healthOf without ruleFor gave the admin's word with the wrong judgment

daemon-found-not-guessed made `promises status` say "broken" by calling the admin's `healthOf`. The admin never calls it bare: `ruleFor(read, reads)` picks the rule per source (a local source beside production is judged by its newest signal, production by its incidents). The first version called `healthOf` with the default incidents rule for every section, so the command printed the admin's word with a different judgment for a laptop source in a project that also has production. The falsification phase found it (A34).

**Rule:** when reusing a shared decision function to make two surfaces agree, find where the other surface chooses its inputs (the rule, the source, the window) and take those too. Agreement on the function name is not agreement on the answer.

**How to apply:** before wiring `X(...)` into a new reader, grep the existing reader for what it passes and what selects it; add a test where the inputs differ (here, local beside production) and assert both surfaces give the same word.

See `.indusk/planning/archive/daemon-found-not-guessed/adr.md` (amendment 4) and `retrospective.md`.
