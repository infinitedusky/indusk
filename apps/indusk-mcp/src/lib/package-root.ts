import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The environment variable `indusk ui` uses to hand the package root to the admin daemon. */
export const PACKAGE_ROOT_ENV = "INDUSK_MCP_PACKAGE_ROOT";

function holdsThisPackage(dir: string): boolean {
	const pkgJson = join(dir, "package.json");
	if (!existsSync(pkgJson)) return false;
	try {
		const parsed = JSON.parse(readFileSync(pkgJson, "utf-8")) as { name?: string };
		return parsed.name === "@infinitedusky/indusk-mcp";
	} catch {
		return false;
	}
}

/**
 * The indusk-mcp package's root, wherever it runs from: a global install
 * (`.../node_modules/@infinitedusky/indusk-mcp/dist/`) or the dev monorepo
 * (`apps/indusk-mcp/dist/`). A root handed through `INDUSK_MCP_PACKAGE_ROOT`
 * wins when it holds this package — the admin's bundler rewrites a module's
 * own location, so code running there cannot walk up to find it. Otherwise
 * walks up from this module until it finds a `package.json` named
 * `@infinitedusky/indusk-mcp`. Shipped scripts (`extensions/...`) are found
 * from here.
 */
export function induskMcpPackageRoot(): string {
	const handed = process.env[PACKAGE_ROOT_ENV];
	if (handed && holdsThisPackage(handed)) return handed;
	let cur = HERE;
	for (let i = 0; i < 8; i++) {
		if (holdsThisPackage(cur)) return cur;
		const parent = dirname(cur);
		if (parent === cur) break;
		cur = parent;
	}
	throw new Error(`could not resolve @infinitedusky/indusk-mcp package root from ${HERE}`);
}
