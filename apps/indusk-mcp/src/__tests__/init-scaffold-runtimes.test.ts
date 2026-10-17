// clause: a-new-project-reports-from-its-first-run/the-service-is-named
// clause: a-new-project-reports-from-its-first-run/every-span-says-where-it-ran
//
// a-new-project-starts-instrumented, Test Phase 1: T3, T7 - what `indusk init` writes for
// each of the four runtimes (Node, Next.js, a browser app, Python), read as code: comments
// stripped, so a name that lives only in a docblock does not count. The service is named
// in code to the project's name, and the project and environment sit on every span's
// resource. Project shapes as in init-browser-telemetry.test.ts.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const NAME = "homework-gate";
// Joined, so this file is not itself a line the placeholder-gone check finds.
const PLACEHOLDER = ["unknown", "service"].join("-");

type Kind = "react-spa" | "nextjs" | "node" | "python";
const KINDS: Kind[] = ["node", "nextjs", "react-spa", "python"];

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A project folder named NAME, so "the project's name" is a value the test knows. */
function project(kind: Kind): string {
	const parent = mkdtempSync(join(tmpdir(), `init-scaffold-runtimes-${kind}-`));
	made.push(parent);
	const dir = join(parent, NAME);
	mkdirSync(dir);
	git(dir, ["init", "-q"]);
	const deps =
		kind === "react-spa"
			? { react: "19.0.0", vite: "6.0.0" }
			: kind === "nextjs"
				? { next: "16.0.0", react: "19.0.0" }
				: { express: "5.0.0" };
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: NAME, version: "0.0.0", dependencies: deps }),
	);
	if (kind === "python") writeFileSync(join(dir, "requirements.txt"), "flask==3.0.0\n");
	if (kind === "react-spa") writeFileSync(join(dir, "vite.config.ts"), "export default {};\n");
	if (kind === "nextjs") writeFileSync(join(dir, "next.config.js"), "module.exports = {};\n");
	if (kind === "react-spa" || kind === "nextjs") mkdirSync(join(dir, "src"));
	return dir;
}

/** Source with its comments removed: block comments, whole-line and trailing `//` and `#`, Python docstrings. */
function code(source: string): string {
	return source
		.replace(/"""[\s\S]*?"""/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|\s)\/\/.*$/gm, "$1")
		.replace(/(^|\s)#.*$/gm, "$1");
}

/** The code of every file init says it created in its [OpenTelemetry] section. */
function writtenCode(dir: string, stdout: string): { file: string; code: string }[] {
	const lines = stdout.split("\n");
	const start = lines.findIndex((l) => l.trim() === "[OpenTelemetry]");
	const rest = start < 0 ? [] : lines.slice(start + 1);
	const end = rest.findIndex((l) => /^\[.+\]$/.test(l.trim()));
	const section = end < 0 ? rest : rest.slice(0, end);
	return section
		.map((l) => /^\s*create: (\S+)/.exec(l)?.[1])
		.filter((p): p is string => Boolean(p))
		.filter((p) => existsSync(join(dir, p)))
		.map((file) => ({ file, code: code(readFileSync(join(dir, file), "utf-8")) }));
}

function scaffold(kind: Kind) {
	const dir = project(kind);
	const r = runCli(dir, ["init"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });
	expect(r.code, `${kind}: init exit\n${r.stderr}`).toBe(0);
	const files = writtenCode(dir, r.stdout);
	expect(files.length, `${kind}: init wrote no instrumentation`).toBeGreaterThan(0);
	return files;
}

describe.skipIf(SHOULD_SKIP)("init-scaffold-runtimes", () => {
	it("T3: for each runtime the written files set the service name in code to the project's name", () => {
		const problems: string[] = [];
		for (const kind of KINDS) {
			const files = scaffold(kind);
			const named = files.some((f) => new RegExp(`["'\`]${NAME}["'\`]`).test(f.code));
			if (!named) problems.push(`${kind}: no written file names "${NAME}" in code`);
			for (const f of files) {
				if (f.code.includes(PLACEHOLDER))
					problems.push(`${kind}: ${f.file} still sets ${PLACEHOLDER}`);
			}
		}
		expect(problems).toEqual([]);
	});

	it("T7: for each runtime the written files put indusk.project and deployment.environment on the resource", () => {
		const problems: string[] = [];
		for (const kind of KINDS) {
			const all = scaffold(kind)
				.map((f) => f.code)
				.join("\n");
			for (const key of ["indusk.project", "deployment.environment"]) {
				if (!all.includes(key)) problems.push(`${kind}: no written file sets ${key} in code`);
			}
		}
		expect(problems).toEqual([]);
	});
});
