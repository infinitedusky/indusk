import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import { git } from "./cli.js";

/**
 * One builder for a promise-bearing project (day-promises, Test Phase 1).
 *
 * Every row of the promises trajectory needs the same precondition in a
 * different shape: a git project with `.indusk/config.json` declaring domains,
 * plan folders for owners (active or archived), `.indusk/promises/<name>.md`
 * and `incidents/<id>.md` files, and code or test files that carry — or omit —
 * the `promise: <name>` token. The tests reach the check over the CLI
 * boundary, so the fixture has to look like a real project, not a mock.
 *
 * It throws when it cannot establish a precondition (a helper that degrades
 * lets every downstream assertion pass while proving nothing).
 */

export type PromiseKind = "behaviour" | "state" | "structure";
export type PromiseState = "declared" | "enforced" | "known-violated" | "retired";
export type PromiseLifetime = "holds" | "established";
export type IncidentSource = "local" | "smoke" | "deployed" | "desk";

export interface PromiseSpec {
	name: string;
	kind: PromiseKind;
	state: PromiseState;
	domain: string;
	owner: string;
	lifetime?: PromiseLifetime;
	statement?: string;
	sites?: string[];
	tests?: string[];
	incidents?: string[];
	aliases?: string[];
	superseded_by?: string;
	/** Frontmatter keys to leave out, for the malformed-entry rows. */
	omit?: string[];
	/** Replace the whole file with this text (e.g. broken YAML). */
	raw?: string;
}

export interface IncidentSpec {
	id: string;
	promise: string;
	source: IncidentSource | string;
	status?: "open" | "fixed";
	date?: string;
	symptom?: string;
	rootCause?: string;
	fix?: string;
	/** Frontmatter keys to leave out. */
	omit?: string[];
	/** Body sections to leave out (`symptom` | `root-cause` | `fix`). */
	omitSections?: string[];
}

export interface PromiseProjectOptions {
	/**
	 * `promises.domains` in config. `undefined` writes no `promises` block at
	 * all; `[]` writes an empty list.
	 */
	domains?: string[];
	/** Plan folders under `.indusk/planning/` (owners the check resolves). */
	activePlans?: string[];
	/** Plan folders under `.indusk/planning/archive/`. */
	archivedPlans?: string[];
	promises?: PromiseSpec[];
	incidents?: IncidentSpec[];
	/** Code and test files, relative to the root, with their content. */
	files?: Record<string, string>;
	/** `false` leaves `.indusk/promises/` absent entirely. */
	registry?: boolean;
	/** Where the registry and plans go, relative to the root (a workbench passes its own). */
	planRoot?: string;
	/** Where `files` go, relative to the root. */
	codeRoot?: string;
	/** Skip `git init` + commit. */
	git?: boolean;
	/** Extra keys merged over the generated config. */
	extraConfig?: Record<string, unknown>;
}

export interface PromiseProject {
	root: string;
	planRoot: string;
	codeRoot: string;
}

/** The token a code site or a test carries. One spelling, the ADR's. */
export function token(name: string): string {
	return `promise: ${name}`;
}

/** A source file whose only content is the token, in a line comment. */
export function siteFile(name: string): string {
	return `// ${token(name)}\nexport const x = 1;\n`;
}

/** A test file whose only content is the token, in a line comment. */
export function testFile(name: string): string {
	return `// ${token(name)}\nimport { it } from "vitest";\nit("names it", () => {});\n`;
}

const DEFAULT_STATEMENT = "A seat is never held by two players at once.";

/** Write one promise file into `dir` (the registry directory). */
export function writePromise(dir: string, spec: PromiseSpec): string {
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${spec.name}.md`);
	if (spec.raw !== undefined) {
		writeFileSync(path, spec.raw);
		return path;
	}
	const frontmatter: Record<string, unknown> = {
		name: spec.name,
		kind: spec.kind,
		lifetime: spec.lifetime ?? "holds",
		state: spec.state,
		domain: spec.domain,
		owner: spec.owner,
		sites: spec.sites ?? [],
		tests: spec.tests ?? [],
		incidents: spec.incidents ?? [],
	};
	if (spec.aliases) frontmatter.aliases = spec.aliases;
	if (spec.superseded_by) frontmatter.superseded_by = spec.superseded_by;
	for (const key of spec.omit ?? []) delete frontmatter[key];
	const statement = "statement" in spec ? spec.statement : DEFAULT_STATEMENT;
	const body =
		statement === undefined || statement === ""
			? ""
			: `${statement}\n\n## History\n- 2026-09-18 — registered.\n`;
	writeFileSync(path, matter.stringify(body, frontmatter));
	return path;
}

/** Write one incident file into `dir` (the incidents directory). */
export function writeIncident(dir: string, spec: IncidentSpec): string {
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${spec.id}.md`);
	const frontmatter: Record<string, unknown> = {
		id: spec.id,
		promise: spec.promise,
		source: spec.source,
		status: spec.status ?? "open",
		date: spec.date ?? "2026-09-18",
	};
	for (const key of spec.omit ?? []) delete frontmatter[key];
	const omit = new Set(spec.omitSections ?? []);
	const sections: string[] = [];
	if (!omit.has("symptom"))
		sections.push(`## Symptom\n${spec.symptom ?? "Two players held seat 4."}\n`);
	if (!omit.has("root-cause"))
		sections.push(`## Root cause\n${spec.rootCause ?? "The hold was not atomic."}\n`);
	if (!omit.has("fix"))
		sections.push(`## Fix\n${spec.fix ?? "Conditional write on the seat row."}\n`);
	writeFileSync(path, matter.stringify(sections.join("\n"), frontmatter));
	return path;
}

/**
 * A git-initialized project with domains declared, owners on disk, a registry
 * and the files the tests point at. Everything committed on `main` unless
 * `git: false`, so the check's reverse scan (which reads git) sees it.
 */
export function promiseProject(opts: PromiseProjectOptions = {}): PromiseProject {
	const root = mkdtempSync(join(tmpdir(), "promises-project-"));
	const planRoot = opts.planRoot ? join(root, opts.planRoot) : root;
	const codeRoot = opts.codeRoot ? join(root, opts.codeRoot) : root;

	mkdirSync(join(planRoot, ".indusk", "planning"), { recursive: true });
	const config: Record<string, unknown> = {
		mode: "full",
		otel: { role: "library" },
		...(opts.domains !== undefined ? { promises: { domains: opts.domains } } : {}),
		...(opts.extraConfig ?? {}),
	};
	writeFileSync(
		join(planRoot, ".indusk", "config.json"),
		`${JSON.stringify(config, null, "\t")}\n`,
	);

	for (const plan of opts.activePlans ?? []) {
		const dir = join(planRoot, ".indusk", "planning", plan);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "brief.md"),
			`---\ntitle: "${plan}"\nstatus: accepted\n---\n\n# ${plan}\n`,
		);
	}
	for (const plan of opts.archivedPlans ?? []) {
		const dir = join(planRoot, ".indusk", "planning", "archive", plan);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "brief.md"),
			`---\ntitle: "${plan}"\nstatus: accepted\n---\n\n# ${plan}\n`,
		);
	}

	if (opts.registry !== false) {
		const registry = join(planRoot, ".indusk", "promises");
		mkdirSync(registry, { recursive: true });
		for (const spec of opts.promises ?? []) writePromise(registry, spec);
		for (const spec of opts.incidents ?? []) writeIncident(join(registry, "incidents"), spec);
	} else if (opts.promises?.length || opts.incidents?.length) {
		throw new Error("promiseProject: registry: false cannot also carry promises or incidents");
	}

	for (const [rel, content] of Object.entries(opts.files ?? {})) {
		const path = join(codeRoot, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	if (opts.git !== false) {
		const init = git(root, ["init", "-q", "-b", "main"]);
		if (init.code !== 0) throw new Error(`promiseProject: git init failed: ${init.stderr}`);
		git(root, ["add", "-A"]);
		const commit = git(root, ["commit", "-q", "--allow-empty", "-m", "fixture"]);
		if (commit.code !== 0) throw new Error(`promiseProject: git commit failed: ${commit.stderr}`);
	}

	return { root, planRoot, codeRoot };
}

/**
 * The common clean shape: one `enforced` promise per kind, each with the links
 * its kind requires, one `known-violated` with an open incident, owners on
 * disk, domains declared. Rows that need a clean baseline start here and
 * break one thing.
 */
export function cleanProjectOptions(): PromiseProjectOptions {
	return {
		domains: ["seating", "archive"],
		activePlans: ["seats-v2"],
		archivedPlans: ["lab-v0"],
		promises: [
			{
				name: "seat-never-double-booked",
				kind: "behaviour",
				state: "enforced",
				domain: "seating",
				owner: "lab-v0",
				sites: ["src/seats.ts"],
				tests: ["src/seats.test.ts"],
			},
			{
				name: "seat-count-matches-table",
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: "seats-v2",
				statement: "A table's seat count equals the seats stored for it.",
				sites: ["src/table.ts"],
				tests: ["src/table.test.ts"],
			},
			{
				name: "one-archive-writer",
				kind: "structure",
				state: "enforced",
				domain: "archive",
				owner: "lab-v0",
				statement: "Exactly one module writes the archive.",
				tests: ["src/archive-writer.test.ts"],
			},
			{
				name: "impact-events-are-strikes",
				kind: "behaviour",
				state: "known-violated",
				domain: "archive",
				owner: "lab-v0",
				statement: "Impact events correspond to ball strikes, never to handling.",
				incidents: ["i-2026-08-26-detector-overtriggers"],
			},
		],
		incidents: [
			{
				id: "i-2026-08-26-detector-overtriggers",
				promise: "impact-events-are-strikes",
				source: "smoke",
				status: "open",
			},
		],
		files: {
			"src/seats.ts": siteFile("seat-never-double-booked"),
			"src/seats.test.ts": testFile("seat-never-double-booked"),
			"src/table.ts": siteFile("seat-count-matches-table"),
			"src/table.test.ts": testFile("seat-count-matches-table"),
			"src/archive-writer.test.ts": testFile("one-archive-writer"),
		},
	};
}
