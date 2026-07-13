# Check consumer-reachability before publishing — monorepo-green ≠ consumer-green

A skill/lib pair can be fully green in the monorepo and broken everywhere else. The cleanup-ritual plan's `/cleanup` skill referenced `apps/indusk-mcp/src/lib/cleanup/oversized.js` — a path that only exists in the dusk source tree — and the lib had no package subpath export, so a published `/cleanup` would have installed cleanly on numero and then failed at its first step. All monorepo tests were green; nothing exercised the consumer view.

Before publishing anything that pairs an agent-facing instruction (skill, hook, prompt) with library code, verify two things from the *consumer's* perspective:

1. **Import paths resolve outside the monorepo** — every lib the instruction references needs a `package.json` subpath export (`./cleanup/oversized`, mirroring `./trajectory/parser` / `./falsification/log`), and the instruction must name the package specifier (`@infinitedusky/indusk-mcp/cleanup/oversized`), not the source path. Dual-form ("package subpath (monorepo: source path)") keeps it usable in both contexts.
2. **The dist outputs exist post-build** — `ls dist/lib/...` after `pnpm build` confirms the export targets are actually produced.

The gap is invisible to every in-repo test because in-repo, the source path resolves. Treat publish-prep as a falsification surface: "would this work on a project where this package is a tarball in node_modules?" — asked before `npm publish`, not after the consumer bug report.
