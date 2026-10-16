# A value a program reads changes readers-first and writers a release later, and research lists every machine reader of it, including installed tools the package does not refresh

Why: in one-promise-language the ADR held the no-skew line for the span attribute (`violated` -> `broken`) but missed `indusk promises health --json`, which the installed VS Code extension parses (`r.outcome === "violated" ? "broke" : "held"`) and `indusk update` never refreshes. The audit found it after the build: an old editor would have shown every broken run as held. Fixed by mapping the in-code verdict back to `violated` at the health line's output until mark-first switches every writer.

Also from the same retrospective: a vocabulary scan proves only the patterns it lists (the first scan refused "the mark" and let "production marks" through), so review must try the senses the scan does not list; and a new look added to a brief needs its page to report the state to the looks check, or the check reads it unchecked (silence), not broken.

Pointers: .indusk/planning/one-promise-language/retrospective.md, adr.md (Accepting), audit.md; /decisions/one-promise-language; apps/indusk-mcp/src/lib/promises/health-line.ts (HealthLineRun).
