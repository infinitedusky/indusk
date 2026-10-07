#!/usr/bin/env node
/**
 * bundle-example.js — copies the seat-holds example (the repository's
 * `examples/seat-holds/`) into apps/indusk-mcp/examples/ so the published
 * tarball carries it, and `indusk demo` copies it from the installed version
 * (demo-app-template D1, D6).
 *
 * Run by `prepack`, so `pnpm pack` and `pnpm publish` both get it. The source
 * is `examples/seat-holds/`; the copy here is .gitignore'd and never edited.
 * Left out: anything installed or local to one machine (node_modules, the
 * evaluator's state under .indusk/eval and .indusk/agents).
 */

import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const source = join(pkg, "..", "..", "examples", "seat-holds");
const dest = join(pkg, "examples", "seat-holds");
const localState = /(^|\/)(node_modules|\.indusk\/eval|\.indusk\/agents)(\/|$)/;

if (!existsSync(source)) {
	console.error(`[bundle-example] no example at ${source}`);
	process.exit(1);
}
rmSync(join(pkg, "examples"), { recursive: true, force: true });
cpSync(source, dest, {
	recursive: true,
	filter: (src) => !localState.test(relative(source, src)),
});
console.info(`[bundle-example] copied ${relative(pkg, source)} → examples/seat-holds`);
