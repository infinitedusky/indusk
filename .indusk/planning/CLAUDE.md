# Planning rules

Loaded by Claude Code whenever a file under `.indusk/planning/` is read: the
rules of plan documents, delivered where a plan is written and nowhere else.
Package-owned — `indusk init` writes this file and `indusk update` overwrites
it from the package's `templates/planning/CLAUDE.md`; edit the template, never
this copy.

- A trajectory row's `Test` column may name a `manual:` command; `verify`
  reports such a row unverified, never passed.
