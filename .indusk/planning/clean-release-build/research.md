---
title: "Clean release build — Research"
date: 2026-10-09
status: complete
workflow: bugfix
---

# Clean release build — Research

## Question

Why did a deleted, vulnerable module ship in every release from 1.33.1 to 1.67.0, and which commands InDusk runs still build a shell string from a value it does not control?

## Background

On 2026-10-09 a security researcher, Timur Juraev (handle casablanka), privately reported an OS command injection (CWE-78) in `dist/tools/graph-tools.js` of `@infinitedusky/indusk-mcp` 1.67.0: five graph tools interpolated a tool parameter into an `execSync` shell string. They intend to request a CVE and will review a patch.

## Findings

### Where the flaw was reachable

- `graph-tools.ts` was deleted in the InDusk Makeover (commit 31bcd000, 2026-07-23).
- Checked against the published tarballs: 1.33.0's server registers the graph tools; 1.33.1, published 2026-07-24, is the first whose server does not. The injection is reachable through MCP in **1.33.0 and earlier** (from the release that added the tools).
- From 1.33.1 to 1.67.0 the compiled `dist/tools/graph-tools.js` still ships, but nothing imports it and no package export names its path. The researcher drove its handlers directly.

### Why deleted code shipped

- `pnpm build` is `tsc`, which writes output and never deletes it. `pnpm publish` packs the working tree. A source file deleted after it was once built keeps its compiled copy.
- 1.67.0 carried **33** compiled files with no source, among them the Graphiti client, the semantic-graph and beam modules, and the `infra` command.
- 1.68.0 was built from an emptied `dist/` on 2026-10-09: 1,063 files, no compiled file without a source. Nothing stops it recurring.
- **Emptying `dist/` breaks the global `indusk`**: `tsc` writes `dist/bin/cli.js` without the executable bit, which `npm install -g` had set once; the version manager then drops the `indusk` shim. Observed 2026-10-09; fixed by hand with `chmod +x` and `mise reshim`.

### Shell strings still built from values

Ten `execSync` calls in the package build a shell string from a template:

| File | Calls | Value interpolated | Where the value comes from |
|---|---|---|---|
| `src/bin/commands/extensions.ts` | 2 | `npm pack ${pkg}` | the person's argument, or a registry entry |
| `src/bin/commands/extensions.ts` | 2 | `curl -sf "${url}"` / `"${from}"` | a URL argument or manifest |
| `src/bin/commands/extensions.ts` | 2 | `claude mcp remove -s project ${name}` | an MCP server name, possibly from a third-party extension's manifest |
| `src/bin/commands/eval.ts` | 3 | worktree path, `baseline: ${taskName}` | the eval task's name and a temp path |
| `scripts/bundle-admin.js` | 1 | `du -sk "${dir}"` | a build-time path |

Two `shell: true` calls run commands a project's own config defines (the worktree setup command) or a hook's fixed command; those are commands, not values.

## Decisions

- **Remove the leftovers and stop them recurring, rather than patch the dead module** (Sandy, 2026-10-09): the module's source no longer exists.
- **1.68.0 ships clean by hand; this plan makes it permanent and is the release that credits the researcher** (Sandy, 2026-10-09).
- **The advisory names ≤ 1.33.0, fixed in 1.33.1**, published by the project as a GitHub Security Advisory so the range is ours to state.

## Open Questions

- Which release added the graph tools, for the advisory's lower bound.

## Sources

- The researcher's report (private, 2026-10-09).
- `npm pack @infinitedusky/indusk-mcp@1.32.0 / 1.33.0 / 1.33.1 / 1.67.0` — server registration and file lists.
