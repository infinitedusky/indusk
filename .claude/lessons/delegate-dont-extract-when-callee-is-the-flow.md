# Delegate to an existing command instead of extracting a helper when the callee already IS the whole flow

When adding a new command/entry point that needs to do everything an existing one already does (plus a thin bit of setup), delegate to the existing one rather than extracting a shared helper.

Concrete case (`workbench-setup-command`): `indusk setup <path>` needed the full workbench-init flow (trunk symlink + config write + extension enable). The brief proposed extracting that block from `init.ts` into a shared function. The impl instead had `setup` derive its args and call `init(workbenchDir, { workbench: true, ... })` directly. Because `init --workbench` already IS the encapsulated workbench-init flow, delegation gave a single code path with zero drift — and made the "init --workbench still works" regression test a near-tautology.

Rule of thumb: reach for extraction only when the shared logic is NOT already a callable unit. If it already is one (a public function, a CLI command), wrapping it is simpler, eliminates the possibility of drift between two copies, and turns the regression guard for the wrapped path into a free correctness proof. Flag the deviation from the brief when you make this call — it's a design improvement, not a shortcut.
