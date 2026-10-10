import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { readWorkflowSteps } from "../checks/steps.js";
import { readConfig } from "../config.js";
import { firstParentLogSync, type TrunkCommit } from "../git.js";
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

/** The earliest changelog release that names `plan` in parentheses — the fallback for a project with no release commits. */
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

/** The trunk's first-parent line, oldest first, read once for every plan. */
export type Trunk = TrunkCommit[];

const RELEASE_COMMIT = /^chore\(release\): (\S+)/;

/**
 * The release that shipped a plan: the first `chore(release): <version>`
 * commit after its landing on the trunk's first-parent line. The landing
 * commit is the one the retrospective names; else the plan's
 * `Merge branch 'plan/<name>'` commit; else, with only a date, the first
 * release dated on or after it. Null when no release follows (not yet
 * released) or the landing cannot be placed. `predates` is true when the plan
 * landed before the trunk's earliest release commit: if releases older than
 * that commit exist (made without one), the commits cannot say which shipped it.
 */
function shippedIn(
	plan: string,
	landing: { sha?: string; date: string | null },
	trunk: Trunk,
): { release: PlanDates["released"]; predates: boolean; earliest: string | null } {
	const at = (c: TrunkCommit) => {
		const m = RELEASE_COMMIT.exec(c.subject);
		return m ? { version: m[1], date: c.date } : null;
	};
	let from = -1;
	const sha = landing.sha;
	if (sha && sha.length >= 7) from = trunk.findIndex((c) => c.sha.startsWith(sha));
	if (from < 0) {
		const merge = `Merge branch 'plan/${plan}'`;
		from = trunk.findIndex((c) => c.subject === merge || c.subject.startsWith(`${merge} `));
	}
	const firstRelease = trunk.findIndex((c) => at(c) !== null);
	const earliest = firstRelease >= 0 ? (at(trunk[firstRelease])?.date ?? null) : null;
	if (from >= 0) {
		const predates = from < firstRelease;
		for (const c of trunk.slice(from + 1)) {
			const release = at(c);
			if (release) return { release, predates, earliest };
		}
		return { release: null, predates, earliest };
	}
	if (!landing.date) return { release: null, predates: false, earliest };
	const predates = earliest !== null && landing.date < earliest;
	for (const c of trunk) {
		const release = at(c);
		if (release && release.date >= landing.date) return { release, predates, earliest };
	}
	return { release: null, predates, earliest };
}

/**
 * The first changelog release dated on or after `date` — the changelog read as
 * the release history where the trunk's commits do not reach (a release ships
 * what landed before it; a same-day landing is read as shipped that day).
 */
function releaseOnOrAfter(changelog: string, date: string | null): PlanDates["released"] {
	if (!date) return null;
	let found: PlanDates["released"] = null;
	for (const m of changelog.matchAll(/^## \[([^\]]+)\]\s*—\s*(\d{4}-\d{2}-\d{2})/gm)) {
		if (m[2] >= date && (found === null || m[2] < found.date))
			found = { version: m[1], date: m[2] };
	}
	return found;
}

/** Whether the changelog records a dated release older than `date`: releases the trunk's commits do not. */
function changelogHasReleaseBefore(changelog: string | undefined, date: string | null): boolean {
	if (!changelog || !date) return false;
	for (const m of changelog.matchAll(/^## \[[^\]]+\]\s*—\s*(\d{4}-\d{2}-\d{2})/gm)) {
		if (m[1] < date) return true;
	}
	return false;
}

/** The retrospective's `Landed on main at <sha>, <date>.` line — the one place it is read. */
function landingLine(planDir: string): { sha?: string; date: string } | null {
	const m = read(join(planDir, "retrospective.md"))?.match(
		/Landed on main at\s*([0-9a-f]{4,40})?[^\n]*?(\d{4}-\d{2}-\d{2})/i,
	);
	return m ? { sha: m[1], date: m[2] } : null;
}

/**
 * When a plan landed (`YYYY-MM-DD`): the retrospective's landing line; for a
 * plan in `archive/` — on main by construction — with no such line (every
 * plan retired before the line was written), its retrospective's `date`,
 * else its impl's. The one landing-date rule: `planDates` and the monitor's
 * `closedAt` both ask here.
 */
export function landedDate(planDir: string, archived = false): string | null {
	return landingLine(planDir)?.date ?? (archived ? archivedLanding(planDir) : null);
}

/**
 * A plan's dates from facts already on disk: the brief's `date`, the landing
 * date (`landedDate`), and the release that shipped it — read from the
 * trunk's release commits when `opts.trunk` has any, else from the changelog
 * (its text), the earliest release naming the plan.
 */
export function planDates(
	planDir: string,
	changelog?: string,
	opts: { archived?: boolean; trunk?: Trunk | null } = {},
): PlanDates {
	const started = firstDate(planDir, STARTING_DOCS);
	const landed = landedDate(planDir, opts.archived);
	let released: PlanDates["released"] = null;
	if (landed || opts.archived) {
		const plan = basename(planDir);
		const fromCommits =
			opts.trunk?.some((c) => RELEASE_COMMIT.test(c.subject)) === true
				? shippedIn(plan, { sha: landingLine(planDir)?.sha, date: landed }, opts.trunk)
				: null;
		// The commits cannot place the release when there are none, or when the plan landed before
		// the earliest one while the changelog records older releases: the changelog decides, else none.
		const unplaceable =
			fromCommits === null ||
			(fromCommits.predates && changelogHasReleaseBefore(changelog, fromCommits.earliest));
		released = unplaceable
			? changelog
				? (releaseOf(plan, changelog) ?? releaseOnOrAfter(changelog, landed))
				: null
			: fromCommits.release;
	}
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
	const trunk = firstParentLogSync(projectRoot);
	const names: HealthNames = { planTitles: {}, planDates: {}, words: displayWords(projectRoot) };
	for (const folder of planFolders(projectRoot)) {
		if (folder.plan in names.planTitles) continue;
		names.planTitles[folder.plan] = planTitle(
			frontmatter(read(join(folder.dir, "brief.md")), "title"),
			folder.plan,
		);
		names.planDates[folder.plan] = planDates(folder.dir, changelog, {
			archived: folder.archived,
			trunk,
		});
	}
	return names;
}
