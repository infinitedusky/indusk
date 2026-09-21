import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { isUsableRelPath, isUsableSegment } from "../path-segment.js";
import {
	INCIDENT_SOURCES,
	INCIDENT_STATUSES,
	INCIDENTS_SUBDIR,
	type IncidentSource,
	type IncidentStatus,
	PROMISE_KINDS,
	PROMISE_LIFETIMES,
	PROMISE_NAME,
	PROMISE_STATES,
	PROMISES_REL_DIR,
	type PromiseKind,
	type PromiseLifetime,
	type PromiseState,
} from "./vocabulary.js";

export * from "./vocabulary.js";

/**
 * The promise registry — one markdown file per promise under
 * `.indusk/promises/`, one per incident under `.indusk/promises/incidents/`
 * (day-promises ADR D1). Frontmatter is what the machine reads; the body is
 * the statement (first paragraph) and its history, for people.
 *
 * Reading follows the phase-boundary record's rule: the reader validates
 * every entry with one predicate, and a malformed entry is a problem naming
 * the file and the field, never a skipped entry — one bad file must not make
 * the registry look smaller than it is. The CLI, the MCP server and the admin
 * all read through here (the `promises/registry` subpath); none parses the
 * directory itself.
 */

export interface PromiseEntry {
	name: string;
	kind: PromiseKind;
	lifetime: PromiseLifetime;
	state: PromiseState;
	domain: string;
	owner: string;
	/** First paragraph of the body. */
	statement: string;
	/** Code-root-relative paths that carry the token. */
	sites: string[];
	/** Code-root-relative paths that carry the token. */
	tests: string[];
	/** Incident ids. */
	incidents: string[];
	/** Earlier names that still resolve. */
	aliases: string[];
	supersededBy?: string;
	/** Registry-relative file path, e.g. `seat-never-double-booked.md`. */
	file: string;
}

export interface IncidentEntry {
	id: string;
	promise: string;
	source: IncidentSource;
	status: IncidentStatus;
	date: string;
	/**
	 * Where the violation happened, as the span said (day-always-on D6), or
	 * null when it said nothing. One server holds staging and production.
	 */
	environment: string | null;
	symptom: string;
	rootCause: string;
	fix: string;
	/** Registry-relative file path, e.g. `incidents/i-2026-….md`. */
	file: string;
}

export interface Registry {
	/** Absolute path of the registry directory. */
	dir: string;
	promises: PromiseEntry[];
	incidents: IncidentEntry[];
}

/** One malformed entry: the file (registry-relative) and what is wrong with it. */
export interface RegistryProblem {
	file: string;
	problem: string;
}

export type ReadRegistryResult =
	| { ok: true; registry: Registry }
	| { ok: false; missing: string }
	/**
	 * At least one entry is malformed. `partial` holds every well-formed
	 * entry so a page can list them beside the error block — a malformed
	 * entry is named, never skipped, and never hides its neighbours either.
	 */
	| { ok: false; problems: RegistryProblem[]; partial: Registry };

/** Absolute path of the registry directory for a plan root. */
export function promisesDir(planRoot: string): string {
	return join(planRoot, PROMISES_REL_DIR);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
	return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isStringList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Parse frontmatter structurally. gray-matter throws on malformed YAML in
 * plain Node but returns `data: {}` inside vitest, so a document that opens
 * with `---` and yields no data is malformed either way.
 */
function parseFrontmatter(
	raw: string,
): { data: Record<string, unknown>; content: string } | { error: string } {
	let parsed: { data: Record<string, unknown>; content: string };
	try {
		const r = matter(raw);
		parsed = { data: r.data as Record<string, unknown>, content: r.content };
	} catch (err) {
		return { error: `frontmatter could not be parsed: ${(err as Error).message}` };
	}
	if (!raw.trimStart().startsWith("---"))
		return { error: "frontmatter is missing (no `---` block)" };
	if (Object.keys(parsed.data).length === 0) {
		return { error: "frontmatter could not be parsed (no fields read)" };
	}
	return parsed;
}

/** The first paragraph of a body, before any heading. Empty when there is none. */
export function firstParagraph(content: string): string {
	const lines = content.split("\n");
	const out: string[] = [];
	for (const line of lines) {
		const t = line.trim();
		if (t === "" && out.length > 0) break;
		if (t === "") continue;
		if (t.startsWith("#")) break;
		out.push(t);
	}
	return out.join(" ");
}

/**
 * Why `value` is not a promise entry, or null when it is one. The writer and
 * every reader apply this same predicate; `stem` is the file name without
 * `.md`, which must equal `name`.
 */
export function promiseProblem(value: unknown, stem: string, statement: string): string | null {
	if (value === null || typeof value !== "object") return "frontmatter is not an object";
	const v = value as Record<string, unknown>;
	if (typeof v.name !== "string" || v.name === "") return "missing `name`";
	if (!PROMISE_NAME.test(v.name) || !isUsableSegment(v.name)) {
		return `\`name\` "${v.name}" is not kebab-case (${PROMISE_NAME})`;
	}
	if (v.name !== stem) return `\`name\` "${v.name}" does not match the file name "${stem}.md"`;
	if (!isOneOf(PROMISE_KINDS, v.kind))
		return `missing or invalid \`kind\` (expected ${PROMISE_KINDS.join(" | ")})`;
	if (v.lifetime !== undefined && !isOneOf(PROMISE_LIFETIMES, v.lifetime)) {
		return `invalid \`lifetime\` (expected ${PROMISE_LIFETIMES.join(" | ")})`;
	}
	if (!isOneOf(PROMISE_STATES, v.state))
		return `missing or invalid \`state\` (expected ${PROMISE_STATES.join(" | ")})`;
	if (typeof v.domain !== "string" || v.domain === "") return "missing `domain`";
	if (typeof v.owner !== "string" || v.owner === "") return "missing `owner`";
	if (!isUsableSegment(v.owner)) return `\`owner\` "${v.owner}" is not a plan folder name`;
	for (const key of ["sites", "tests", "incidents", "aliases"] as const) {
		if (v[key] !== undefined && !isStringList(v[key]))
			return `\`${key}\` must be a list of strings`;
	}
	// A31: a link path is joined onto the code root by the check, so it must
	// be a relative path that cannot leave it — refused here, at read time,
	// before anything joins it.
	for (const key of ["sites", "tests"] as const) {
		for (const rel of (v[key] as string[] | undefined) ?? []) {
			if (!isUsableRelPath(rel)) {
				return `\`${key}\` entry "${rel}" must be a relative path inside the code root (no leading \`/\`, no \`..\`)`;
			}
		}
	}
	for (const alias of (v.aliases as string[] | undefined) ?? []) {
		if (!PROMISE_NAME.test(alias) || !isUsableSegment(alias)) {
			return `\`aliases\` entry "${alias}" is not kebab-case (${PROMISE_NAME})`;
		}
	}
	if (v.superseded_by !== undefined && typeof v.superseded_by !== "string") {
		return "`superseded_by` must be a promise name";
	}
	if (statement === "") return "no statement (the body's first paragraph is empty)";
	return null;
}

/** Why `value` is not an incident entry, or null when it is one. */
export function incidentProblem(
	value: unknown,
	stem: string,
	sections: { symptom: string; rootCause: string; fix: string },
): string | null {
	if (value === null || typeof value !== "object") return "frontmatter is not an object";
	const v = value as Record<string, unknown>;
	if (typeof v.id !== "string" || v.id === "") return "missing `id`";
	if (!isUsableSegment(v.id)) return `\`id\` "${v.id}" is not a file name`;
	if (v.id !== stem) return `\`id\` "${v.id}" does not match the file name "${stem}.md"`;
	if (typeof v.promise !== "string" || v.promise === "") return "missing `promise`";
	if (!isOneOf(INCIDENT_SOURCES, v.source)) {
		return `missing or invalid \`source\` "${String(v.source ?? "")}" (expected ${INCIDENT_SOURCES.join(" | ")})`;
	}
	if (!isOneOf(INCIDENT_STATUSES, v.status)) {
		return `missing or invalid \`status\` (expected ${INCIDENT_STATUSES.join(" | ")})`;
	}
	if (v.date === undefined || v.date === null || String(v.date) === "") return "missing `date`";
	if (sections.symptom === "") return "missing `## Symptom` section";
	if (sections.rootCause === "") return "missing `## Root cause` section";
	if (sections.fix === "") return "missing `## Fix` section";
	return null;
}

/** The text under a `## Heading` (case-insensitive), up to the next heading. */
export function sectionText(content: string, heading: string): string {
	const lines = content.split("\n");
	const want = heading.toLowerCase();
	let inside = false;
	const out: string[] = [];
	for (const line of lines) {
		const m = /^##\s+(.+?)\s*$/.exec(line);
		if (m) {
			if (inside) break;
			inside = m[1].trim().toLowerCase() === want;
			continue;
		}
		if (inside) out.push(line);
	}
	return out.join("\n").trim();
}

function markdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md") && statSync(join(dir, f)).isFile())
		.sort();
}

/**
 * Read the registry at `planRoot`. `missing` when there is no directory;
 * `problems` when any entry is malformed (all of them, each named); the
 * registry otherwise.
 */
export function readPromises(planRoot: string): ReadRegistryResult {
	const dir = promisesDir(planRoot);
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return { ok: false, missing: dir };

	const problems: RegistryProblem[] = [];
	const promises: PromiseEntry[] = [];
	const incidents: IncidentEntry[] = [];

	for (const file of markdownFiles(dir)) {
		const stem = file.slice(0, -3);
		const raw = readFileSync(join(dir, file), "utf-8");
		const parsed = parseFrontmatter(raw);
		if ("error" in parsed) {
			problems.push({ file, problem: parsed.error });
			continue;
		}
		const statement = firstParagraph(parsed.content);
		const problem = promiseProblem(parsed.data, stem, statement);
		if (problem !== null) {
			problems.push({ file, problem });
			continue;
		}
		const d = parsed.data as Record<string, unknown> & {
			name: string;
			kind: PromiseKind;
			state: PromiseState;
			domain: string;
			owner: string;
		};
		promises.push({
			name: d.name,
			kind: d.kind,
			lifetime: (d.lifetime as PromiseLifetime | undefined) ?? "holds",
			state: d.state,
			domain: d.domain,
			owner: d.owner,
			statement,
			sites: (d.sites as string[] | undefined) ?? [],
			tests: (d.tests as string[] | undefined) ?? [],
			incidents: (d.incidents as string[] | undefined) ?? [],
			aliases: (d.aliases as string[] | undefined) ?? [],
			supersededBy: d.superseded_by as string | undefined,
			file,
		});
	}

	const incidentsDir = join(dir, INCIDENTS_SUBDIR);
	for (const file of markdownFiles(incidentsDir)) {
		const rel = relative(dir, join(incidentsDir, file));
		const stem = file.slice(0, -3);
		const raw = readFileSync(join(incidentsDir, file), "utf-8");
		const parsed = parseFrontmatter(raw);
		if ("error" in parsed) {
			problems.push({ file: rel, problem: parsed.error });
			continue;
		}
		const sections = {
			symptom: sectionText(parsed.content, "Symptom"),
			rootCause: sectionText(parsed.content, "Root cause"),
			fix: sectionText(parsed.content, "Fix"),
		};
		const problem = incidentProblem(parsed.data, stem, sections);
		if (problem !== null) {
			problems.push({ file: rel, problem });
			continue;
		}
		const d = parsed.data as Record<string, unknown> & {
			id: string;
			promise: string;
			source: IncidentSource;
			status: IncidentStatus;
			environment?: unknown;
		};
		incidents.push({
			id: d.id,
			promise: d.promise,
			source: d.source,
			status: d.status,
			date: String(d.date),
			environment: typeof d.environment === "string" && d.environment ? d.environment : null,
			...sections,
			file: rel,
		});
	}

	problems.push(...aliasProblems(promises));

	const registry: Registry = { dir, promises, incidents };
	if (problems.length > 0) return { ok: false, problems, partial: registry };
	return { ok: true, registry };
}

/**
 * Do the aliases resolve to exactly one live promise each? (A29.) A
 * registry-wide fact, judged after every entry is read: an alias equal to a
 * live name, or shared by two entries, would make the check pick a winner
 * silently. Every file involved is named.
 */
export function aliasProblems(promises: readonly PromiseEntry[]): RegistryProblem[] {
	const problems: RegistryProblem[] = [];
	const byName = new Map(promises.map((p) => [p.name, p]));
	const aliasOwners = new Map<string, PromiseEntry[]>();
	for (const p of promises) {
		for (const alias of p.aliases) {
			const live = byName.get(alias);
			if (live) {
				problems.push({
					file: p.file,
					problem: `alias "${alias}" is also a live promise (${live.file}) — an alias must name a retired spelling, never a current promise`,
				});
			}
			aliasOwners.set(alias, [...(aliasOwners.get(alias) ?? []), p]);
		}
	}
	for (const [alias, owners] of aliasOwners) {
		if (owners.length < 2) continue;
		for (const p of owners) {
			problems.push({
				file: p.file,
				problem: `alias "${alias}" is shared with ${owners
					.filter((o) => o !== p)
					.map((o) => o.file)
					.join(", ")} — an alias resolves to exactly one promise`,
			});
		}
	}
	return problems;
}
