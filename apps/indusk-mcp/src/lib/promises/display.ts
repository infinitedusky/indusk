import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { readWorkflowSteps } from "../checks/steps.js";
import { readConfig } from "../config.js";
import { planFolders } from "./plan-folder.js";

/**
 * How a promise or a plan is named for a person, and a plan's dates — worked
 * out here once (display-names ADR D1–D6). The health line carries the result,
 * so the editor never turns a handle into words itself and the admin reads
 * this module rather than writing a third rule.
 *
 * promise: display-names-are-defined-once
 */

/** Product names that keep their capitals when a handle becomes words. */
export const BUILT_IN_WORDS: Readonly<Record<string, string>> = {
	indusk: "InDusk",
	fly: "Fly",
	jaeger: "Jaeger",
	claude: "Claude",
	vscode: "VS Code",
	otel: "OTel",
	mcp: "MCP",
	cli: "CLI",
	ui: "UI",
	api: "API",
	adr: "ADR",
};

/** A handle in words: hyphens as spaces, the first letter capital, product words spelled their way. */
export function promiseWords(name: string, words: Record<string, string> = {}): string {
	const spelled = { ...BUILT_IN_WORDS, ...words };
	const parts = name.split("-").filter((w) => w !== "");
	const out = parts.map((w) => spelled[w.toLowerCase()] ?? w);
	const first = out[0];
	if (first === undefined) return name;
	if (spelled[parts[0].toLowerCase()] === undefined) {
		out[0] = first.charAt(0).toUpperCase() + first.slice(1);
	}
	return out.join(" ");
}

/** A plan's title: the brief's, up to " — "; its folder name when there is none. */
export function planTitle(title: string | undefined, folder: string): string {
	const short = title?.split(" — ")[0]?.trim();
	return short ? short : folder;
}

/** When a plan started, landed and shipped; `null` for what has not happened. */
export interface PlanDates {
	started: string | null;
	landed: string | null;
	released: { version: string; date: string } | null;
}

const DATE = /\d{4}-\d{2}-\d{2}/;

function read(path: string): string | null {
	return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/**
 * A plan document's frontmatter value for `key`, read through the package's
 * YAML reader (`gray-matter`, as `plan-parser` does) so the plan page and the
 * editor name one plan one way. Unreadable or malformed text reads as absent.
 * A date YAML parses to a Date comes back as `YYYY-MM-DD`.
 */
function frontmatter(text: string | null, key: string): string | undefined {
	if (text === null) return undefined;
	let value: unknown;
	try {
		value = matter(text).data[key];
	} catch {
		return undefined;
	}
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
	}
	return typeof value === "string" ? value.trim() || undefined : undefined;
}

/** The earliest changelog release that names `plan` in parentheses, as every entry does. */
function releaseOf(plan: string, changelog: string): PlanDates["released"] {
	const escaped = plan.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const names = new RegExp(`\\((?:[^)\\n]*,\\s*)?${escaped}(?:\\s*,[^)\\n]*)?\\)`);
	let found: PlanDates["released"] = null;
	// Newest first in the file, so the last match read is the earliest release.
	for (const section of changelog.split(/^## /m).slice(1)) {
		const head = section.match(/^\[([^\]]+)\]\s*—\s*(\d{4}-\d{2}-\d{2})/);
		if (head && names.test(section)) found = { version: head[1], date: head[2] };
	}
	return found;
}

/**
 * A plan's dates from facts already on disk: the brief's `date`, the
 * retrospective's `Landed on main at <sha>, <date>.` line, and the changelog
 * (its text) — the earliest release naming the plan. A plan in `archive/` is on
 * main by construction, so when it has no landing line (every plan retired
 * before the line was written) it landed on its retrospective's `date`, else
 * its impl's.
 */
export function planDates(
	planDir: string,
	changelog?: string,
	opts: { archived?: boolean } = {},
): PlanDates {
	const started = firstDate(planDir, STARTING_DOCS);
	const line = read(join(planDir, "retrospective.md"))?.match(
		/Landed on main at \S+?,\s*(\d{4}-\d{2}-\d{2})/,
	)?.[1];
	const landed = line ?? (opts.archived ? archivedLanding(planDir) : null);
	const released =
		(landed || opts.archived) && changelog ? releaseOf(basename(planDir), changelog) : null;
	return { started, landed, released };
}

/** The first of `docs`, in order, whose frontmatter carries a `date`. */
function firstDate(planDir: string, docs: readonly string[]): string | null {
	for (const doc of docs) {
		const date = frontmatter(read(join(planDir, doc)), "date")?.match(DATE)?.[0];
		if (date) return date;
	}
	return null;
}

/** A plan with no brief (a spike, a parent) started with its first lifecycle document. */
const STARTING_DOCS = ["brief.md", "research.md", "test-plan.md", "adr.md", "impl.md"] as const;

/** When an archived plan with no landing line landed: its retrospective's `date`, else its impl's. */
function archivedLanding(planDir: string): string | null {
	return firstDate(planDir, ["retrospective.md", "impl.md"]);
}

/** `display.words` from the project's config, merged over the built-in words. */
export function displayWords(projectRoot: string): Record<string, string> {
	let configured: unknown;
	try {
		configured = (readConfig(projectRoot) as { display?: { words?: unknown } } | null)?.display
			?.words;
	} catch {
		configured = undefined;
	}
	const own: Record<string, string> = {};
	if (typeof configured === "object" && configured !== null) {
		for (const [word, spelling] of Object.entries(configured)) {
			if (typeof spelling === "string" && spelling !== "") own[word.toLowerCase()] = spelling;
		}
	}
	return { ...BUILT_IN_WORDS, ...own };
}

/** What `healthLine` needs to name things: read once per line from the plan folders, the changelog and the config. */
export interface HealthNames {
	planTitles: Record<string, string>;
	planDates: Record<string, PlanDates>;
	words: Record<string, string>;
}

/** The names for a project, from its plan folders (active, then archived) and its declared changelog. */
export function readHealthNames(projectRoot: string): HealthNames {
	let changelogPath: string | undefined;
	try {
		changelogPath = readWorkflowSteps(projectRoot).release?.changelog;
	} catch {
		changelogPath = undefined;
	}
	const changelog = changelogPath
		? (read(join(projectRoot, changelogPath)) ?? undefined)
		: undefined;
	const names: HealthNames = { planTitles: {}, planDates: {}, words: displayWords(projectRoot) };
	for (const folder of planFolders(projectRoot)) {
		if (folder.plan in names.planTitles) continue;
		names.planTitles[folder.plan] = planTitle(
			frontmatter(read(join(folder.dir, "brief.md")), "title"),
			folder.plan,
		);
		names.planDates[folder.plan] = planDates(folder.dir, changelog, { archived: folder.archived });
	}
	return names;
}
