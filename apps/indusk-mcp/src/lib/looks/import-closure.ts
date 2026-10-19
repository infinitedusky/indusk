import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * The files a source file reaches through its imports, read with the app's own
 * TypeScript (`preProcessFile` for the specifiers, `resolveModuleName` with the
 * app's `tsconfig` for where they point), so its path aliases and module
 * resolution are the app's, not ours. Stays inside the project: a package in
 * `node_modules` is not part of the app's source. Reads files; never runs one.
 */

export type TypeScript = typeof import("typescript");

const CODE = /\.(?:[cm]?[jt]sx?)$/;

/** The app's TypeScript, loaded from its own folder; null when it has none to load. */
export function loadTypeScript(appDir: string): TypeScript | null {
	try {
		return createRequire(join(appDir, "package.json"))("typescript") as TypeScript;
	} catch {
		return null;
	}
}

/** The app's compiler options from the nearest `tsconfig.json`, or a loose default when it has none. */
function compilerOptions(ts: TypeScript, appDir: string) {
	const config = ts.findConfigFile(appDir, ts.sys.fileExists, "tsconfig.json");
	if (config) {
		const read = ts.readConfigFile(config, ts.sys.readFile);
		if (!read.error)
			return ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(config)).options;
	}
	return { allowJs: true } as import("typescript").CompilerOptions;
}

/**
 * A reader of one file's direct imports, as absolute paths inside `root`,
 * remembering what it read. A relative import that TypeScript cannot resolve
 * (a stylesheet) is kept when the file exists, as a leaf.
 */
export function importReader(
	ts: TypeScript,
	appDir: string,
	root: string,
): (file: string) => string[] {
	const options = compilerOptions(ts, appDir);
	const memo = new Map<string, string[]>();
	const inside = (file: string) =>
		file.startsWith(root + sep) && !file.includes(`${sep}node_modules${sep}`);
	return (file) => {
		const known = memo.get(file);
		if (known) return known;
		const found = new Set<string>();
		memo.set(file, []);
		if (CODE.test(file) && existsSync(file)) {
			const names = ts.preProcessFile(readFileSync(file, "utf-8"), true, true).importedFiles;
			for (const { fileName } of names) {
				const resolved = ts.resolveModuleName(fileName, file, options, ts.sys).resolvedModule;
				const target = resolved ? resolve(resolved.resolvedFileName) : undefined;
				if (target && inside(target) && !target.endsWith(".d.ts")) found.add(target);
				else if (!resolved && fileName.startsWith(".")) {
					const leaf = resolve(dirname(file), fileName);
					if (inside(leaf) && existsSync(leaf)) found.add(leaf);
				}
			}
		}
		const direct = [...found].sort();
		memo.set(file, direct);
		return direct;
	};
}

/** `entries` and everything they reach, as paths relative to `root` with `/` separators, sorted. */
export function closureOf(
	entries: readonly string[],
	importsOf: (file: string) => string[],
	root: string,
): string[] {
	const seen = new Set<string>();
	const queue = [...entries];
	for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
		if (seen.has(file)) continue;
		seen.add(file);
		queue.push(...importsOf(file));
	}
	return [...seen].map((f) => relative(root, f).split(sep).join("/")).sort();
}
