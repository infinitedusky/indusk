# A denylist guard (a pattern list that refuses forms) is proved by an adversarial row set or a witness of what really changed — never only by the forms its author thought of

The shell-write guard's rows (A22–A35, A75–A77) enumerated the command forms the author thought of, so a pattern list passed its rows while `perl -0pi`, a stdin script, a variable holding the path, `git apply` of a patch, `awk -i inplace`, `sponge` and `ed` could still write plan documents, and `stdout.write` reads and `git clean -n` were refused (plan-write-guard.js:486, :68; audit.md, highlight h-20261019-034).

Rule: a guard that refuses by matching forms gets (1) a row set written adversarially, by someone trying to get around it and by listing the false refusals of reads, and (2) a witness that reports what actually changed after a command the guard allowed, which is the independent proof. The author's examples prove only the author's imagination. State the guard as a tripwire, not a boundary, when it reads text.

See .indusk/planning/a-run-can-be-trusted/audit.md and the plan's plan-write-witness hook.
