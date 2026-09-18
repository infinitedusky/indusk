# Before writing a `pnpm --filter <name>` command into an impl.md verification item, read that package's actual `name` field — don't assume the `@infinitedusky/` scope

In dusk, package.json `name` fields are inconsistent: `apps/indusk-mcp` is scoped (`@infinitedusky/indusk-mcp`), `apps/docs` is scoped (`@infinitedusky/docs`), but `apps/indusk-admin`'s package.json name is the bare `indusk-admin` — no scope.

admin-plan-worktrees' impl.md (`.indusk/planning/admin-plan-worktrees/impl.md`) wrote every admin-targeting verification command as `pnpm --filter @infinitedusky/indusk-admin ...` (lines 106, 114, 196, 197). Running any of them produces "No projects matched the filters" — pnpm silently matches zero packages and exits nonzero, it doesn't fuzzy-match. The Test Phase 1 Verification checklist item at line 114 was checked off `[x]` despite naming a command that cannot have run as written; the eval agent caught the discrepancy by actually running the verbatim command rather than trusting the checkbox.

The bad name propagates forward: two Build Phase 3 verification gates (lines 196, 197) still carry the same wrong filter and will fail identically when that phase is worked, unless corrected first.

How to apply: when authoring or reviewing a verification command that uses `pnpm --filter <name>` or `pnpm turbo test --filter=<name>`, grep the target package's actual `package.json` `"name"` field first — never infer it from the sibling packages' scoping convention or the directory name. This is a general pattern for any monorepo with mixed scoped/unscoped package names, not specific to one plan.
