import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The indusk-mcp package's root, wherever it runs from: a global install
 * (`.../node_modules/@infinitedusky/indusk-mcp/dist/`) or the dev monorepo
 * (`apps/indusk-mcp/dist/`). Walks up from this module until it finds a
 * `package.json` named `@infinitedusky/indusk-mcp`. Shipped scripts
 * (`extensions/...`) are found from here.
 */
export function induskMcpPackageRoot(): string {
	let cur = HERE;
	for (let i = 0; i < 8; i++) {
		const pkgJson = join(cur, "package.json");
		if (existsSync(pkgJson)) {
			try {
				const parsed = JSON.parse(readFileSync(pkgJson, "utf-8")) as { name?: string };
				if (parsed.name === "@infinitedusky/indusk-mcp") return cur;
			} catch {
				// fall through
			}
		}
		const parent = dirname(cur);
		if (parent === cur) break;
		cur = parent;
	}
	throw new Error(`could not resolve @infinitedusky/indusk-mcp package root from ${HERE}`);
}
