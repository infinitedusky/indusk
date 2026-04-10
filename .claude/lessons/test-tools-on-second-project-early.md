# Test developer tools on a second project early

# Test developer tools on a second project early

When building a tool in a monorepo, the source repo is the worst place to test it — everything works by coincidence (paths resolve, packages exist locally, configs are already correct).

Test on a second project as soon as the integration layer is built (hooks, CLI registration, MCP config). Every cross-project portability bug in the eval system was invisible until tested on Numero: hardcoded monorepo paths, `claude mcp add` not overwriting, hook registration skipping new entries, package resolution assuming local structure.

The rule: if Phase N wires up the integration, test on a second codebase at Phase N — not after all phases are done.
