// clause: a-new-project-is-told-the-truth/next-steps-exist
// promise: a-new-project-is-told-the-truth
//
// a-new-project-starts-instrumented, Test Phase 1: T16 - everything `indusk init` tells a
// person to run or use is there. Every `indusk <command>` it prints is a command of the
// built command line; every file a `create:` line announces, and every file a `wire:` line
// imports or runs, exists once init is done; the retired `indusk infra start` is gone; and
// `indusk editor install` is printed exactly once. Run on a Node project through the built CLI.
//
// Build Phase 4: T26 - the install line init prints for a runtime names every package the
// files it scaffolded for that runtime import (a package pnpm does not hoist is not
// resolvable from the app's source unless the app lists it).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function nodeProject(): string {
	const parent = mkdtempSync(join(tmpdir(), "init-next-steps-"));
	made.push(parent);
	const dir = join(parent, "homework-gate");
	mkdirSync(join(dir, "src"), { recursive: true });
	git(dir, ["init", "-q"]);
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "homework-gate", version: "0.0.0", dependencies: { express: "5.0.0" } }),
	);
	// The app's own entry, which the printed `wire:` line runs.
	writeFileSync(join(dir, "src", "index.ts"), "export {};\n");
	return dir;
}

/** The top-level commands of the built command line, read from `indusk --help`. */
function commandsOfTheCli(cwd: string): Set<string> {
	const help = runCli(cwd, ["--help"]).stdout.split("\n");
	const from = help.findIndex((l) => l.trim() === "Commands:");
	const names = help
		.slice(from + 1)
		.map((l) => /^ {2}([a-z][\w-]*)\b/.exec(l)?.[1])
		.filter((n): n is string => Boolean(n));
	return new Set([...names, "help"]);
}

describe.skipIf(SHOULD_SKIP)("init-next-steps", () => {
	it("T16: init's printed commands and files exist, the removed infra command is gone, and the editor install is printed once", () => {
		const dir = nodeProject();
		const r = runCli(dir, ["init"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });
		expect(r.code, `init exit\n${r.stderr}`).toBe(0);
		const lines = r.stdout.split("\n");

		// Every `indusk <word>` names a command the CLI has.
		const known = commandsOfTheCli(dir);
		const unknown = lines.flatMap((l) =>
			[...l.matchAll(/\bindusk ([a-z][\w-]*)/g)]
				.map((m) => m[1] as string)
				.filter((word) => !known.has(word))
				.map((word) => `indusk ${word}  <-  ${l.trim()}`),
		);
		expect(unknown, "init prints a command the CLI does not have").toEqual([]);
		expect(r.stdout, "the removed infra command").not.toContain("indusk infra start");

		// Every file a `create:` line announces exists afterwards.
		const announced = lines
			.map((l) => /^\s*create: (\S+)/.exec(l)?.[1])
			.filter((p): p is string => Boolean(p))
			.map((p) => p.replace(/\/$/, ""));
		const missingCreated = announced.filter((p) => !existsSync(join(dir, p)));
		expect(missingCreated, "init announced a file it did not write there").toEqual([]);

		// Every file a `wire:` line imports or runs exists afterwards.
		const wired = lines
			.filter((l) => /^\s*wire[^:]*:/.test(l))
			.flatMap((l) => [...l.matchAll(/(?:^|\s|')(\.{0,2}\/?[\w./-]+\.(?:ts|tsx|js|mjs|py))\b/g)])
			.map((m) => m[1] as string);
		const missingWired = wired.filter((p) => !existsSync(join(dir, p)));
		expect(missingWired, "init tells a person to run or import a file that is not there").toEqual(
			[],
		);

		// The editor install is printed once.
		const editor = lines.filter((l) => l.includes("indusk editor install"));
		expect(editor, "`indusk editor install` printed exactly once").toHaveLength(1);
	});
});

type Kind = "node" | "nextjs" | "browser";

/** A fresh app of one kind, as create-next-app, create-vite or an Express project would leave it. */
function appOf(kind: Kind): string {
	const parent = mkdtempSync(join(tmpdir(), `init-install-line-${kind}-`));
	made.push(parent);
	const dir = join(parent, "homework-gate");
	mkdirSync(join(dir, "src"), { recursive: true });
	git(dir, ["init", "-q"]);
	const deps =
		kind === "nextjs"
			? { next: "16.0.0", react: "19.0.0" }
			: kind === "browser"
				? { react: "19.0.0", vite: "6.0.0" }
				: { express: "5.0.0" };
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "homework-gate", version: "0.0.0", dependencies: deps }),
	);
	if (kind === "nextjs") writeFileSync(join(dir, "next.config.js"), "module.exports = {};\n");
	if (kind === "browser") writeFileSync(join(dir, "vite.config.ts"), "export default {};\n");
	return dir;
}

/** The package each bare import or `from` names in a source file, without a subpath. */
function importedPackages(source: string): string[] {
	const names = [...source.matchAll(/(?:from|import)\s+["']([^"'.][^"']*)["']/g)].map(
		(m) => m[1] as string,
	);
	return names
		.filter((n) => !n.startsWith("node:"))
		.map((n) =>
			n.startsWith("@") ? n.split("/").slice(0, 2).join("/") : (n.split("/")[0] as string),
		);
}

describe.skipIf(SHOULD_SKIP)("init-next-steps: the install line", () => {
	it.each(["node", "nextjs", "browser"] as const)(
		"T26: the install line for a %s app names every package its scaffolded files import",
		(kind) => {
			const dir = appOf(kind);
			const r = runCli(dir, ["init"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });
			expect(r.code, `init exit\n${r.stderr}`).toBe(0);
			const lines = r.stdout.split("\n");

			const written = lines
				.map((l) => /^\s*create: (\S+)/.exec(l)?.[1])
				.filter((p): p is string => Boolean(p) && /\.(ts|tsx)$/.test(p as string));
			expect(written.length, "init wrote scaffold files").toBeGreaterThan(0);
			const imported = new Set(
				written.flatMap((p) => importedPackages(readFileSync(join(dir, p), "utf-8"))),
			);

			const install = lines.find((l) => /^\s*install:/.test(l)) ?? "";
			const named = new Set(install.replace(/^\s*install:\s*pnpm add\s+/, "").split(/\s+/));
			const missing = [...imported].filter((p) => !named.has(p));
			expect(missing, `imported by the scaffolded files, absent from "${install.trim()}"`).toEqual(
				[],
			);
		},
	);
});
