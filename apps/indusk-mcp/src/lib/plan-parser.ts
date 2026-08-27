import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { getPlanningDir } from "./config.js";
import { isCleanSegment } from "./path-segment.js";

export interface PlanFrontmatter {
	title: string;
	date: string;
	status: string;
}

export type PlanStage =
	| "research"
	| "brief"
	| "adr"
	| "impl"
	| "retrospective"
	| "unknown"
	| "malformed";

export interface PlanSummary {
	name: string;
	stage: PlanStage;
	stageStatus: string;
	nextStep: string;
	dependencies: string[];
	documents: string[];
	/** Set when frontmatter in one of the plan's docs failed to parse. Contains
	 * the file + error so the operator can fix it. The whole plan still appears
	 * in the listing rather than poisoning `list_plans` entirely. */
	parseError?: { file: string; message: string };
}

const STAGE_ORDER: Exclude<PlanStage, "unknown" | "malformed">[] = [
	"research",
	"brief",
	"adr",
	"impl",
	"retrospective",
];

interface ParseFrontmatterResult {
	frontmatter: PlanFrontmatter | null;
	parseError?: { file: string; message: string };
}

function parseFrontmatter(filePath: string): ParseFrontmatterResult {
	if (!existsSync(filePath)) return { frontmatter: null };
	const raw = readFileSync(filePath, "utf-8");
	try {
		const { data } = matter(raw);
		return {
			frontmatter: {
				title: (data.title as string) ?? "",
				date: (data.date as string) ?? "",
				status: (data.status as string) ?? "",
			},
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[plan-parser] frontmatter parse error in ${filePath}: ${message}\n`);
		return {
			frontmatter: null,
			parseError: { file: filePath, message },
		};
	}
}

function parseDependsOn(filePath: string): string[] {
	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, "utf-8");
	const depsMatch = content.match(/## Depends On\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
	if (!depsMatch) return [];

	const deps: string[] = [];
	for (const line of depsMatch[1].split("\n")) {
		const match = line.match(/^-\s+`?(?:\.indusk\/)?planning\/([^/`]+)\/?`?/);
		if (match) {
			deps.push(match[1]);
		}
	}
	return deps;
}

function determineStage(
	planDir: string,
	docs: string[],
): {
	stage: PlanStage;
	stageStatus: string;
	parseError?: { file: string; message: string };
} {
	// Walk stages in reverse to find the most advanced document
	for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
		const stage = STAGE_ORDER[i];
		const file = `${stage}.md`;
		if (docs.includes(file)) {
			const result = parseFrontmatter(join(planDir, file));
			if (result.parseError) {
				return {
					stage: "malformed",
					stageStatus: "parse-error",
					parseError: result.parseError,
				};
			}
			return { stage, stageStatus: result.frontmatter?.status ?? "unknown" };
		}
	}
	return { stage: "unknown", stageStatus: "unknown" };
}

function determineNextStep(
	stage: PlanStage,
	stageStatus: string,
	parseError?: { file: string; message: string },
): string {
	if (stage === "malformed" && parseError) {
		return `Fix YAML frontmatter at ${parseError.file}: ${parseError.message}`;
	}
	if (stage === "unknown") return "Create a brief";

	const idx = STAGE_ORDER.indexOf(stage as Exclude<PlanStage, "unknown" | "malformed">);

	if (stageStatus === "completed" || stageStatus === "accepted") {
		const next = STAGE_ORDER[idx + 1];
		if (next) return `Create ${next}`;
		return "Done";
	}

	if (stageStatus === "in-progress") {
		return `Continue ${stage}`;
	}

	return `Review ${stage} (status: ${stageStatus})`;
}

export function parsePlan(planDir: string): PlanSummary {
	const name = planDir.split("/").pop() ?? "";
	const entries = readdirSync(planDir).filter((f) => f.endsWith(".md"));

	const { stage, stageStatus, parseError } = determineStage(planDir, entries);
	const dependencies = parseDependsOn(join(planDir, "brief.md"));
	const nextStep = determineNextStep(stage, stageStatus, parseError);

	return {
		name,
		stage,
		stageStatus,
		nextStep,
		dependencies,
		documents: entries,
		...(parseError && { parseError }),
	};
}

/**
 * Plan hierarchy, declared top-down.
 *
 * The root `master.md` names which folders are parent plans (`parents:`) and
 * the top-level display order (`roadmap:`). Each parent's own `master.md`
 * names its ordered children (`subplans:`). Children declare nothing — one
 * direction, one source of truth per relationship, so the two sides can never
 * disagree.
 *
 * Note what is NOT here: the list of plans. The filesystem is the inventory
 * (see {@link parseAllPlans}); declarations only add structure over it. That
 * asymmetry is the load-bearing property — a declaration can group plans but
 * can never subtract one.
 */
export interface PlanDeclarations {
	/** Folder names declared as parent plans in the root master. */
	parents: string[];
	/** Top-level display order from the root master. Unlisted plans follow. */
	roadmap: string[];
	/** Parent folder name → its declared, ordered subplan names. */
	subplans: Record<string, string[]>;
}

// A declaration name must be a single clean path segment — it gets joined into
// filesystem paths (`join(planningDir, name, "master.md")`) and rendered
// verbatim in the sidebar. The guard now lives in `lib/path-segment.ts`,
// shared with workbench repo names, which are the same question.

/**
 * Read a frontmatter key as a string array; anything else yields [].
 * Non-string entries, non-segment names, and duplicates are dropped —
 * duplicates collapse to first occurrence so declared order is preserved.
 */
function stringArray(data: Record<string, unknown>, key: string): string[] {
	const value = data[key];
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string" || !isCleanSegment(entry)) continue;
		if (out.includes(entry)) continue;
		out.push(entry);
	}
	return out;
}

/**
 * Frontmatter of a `master.md`, or null when absent/unreadable/malformed.
 *
 * gray-matter throws on malformed YAML in plain Node but returns `data: {}`
 * inside vitest — so this treats both the throw and the empty-object case as
 * "no declaration", which is the same safe outcome either way.
 */
function readMasterFrontmatter(masterPath: string): Record<string, unknown> | null {
	if (!existsSync(masterPath)) return null;
	try {
		return matter(readFileSync(masterPath, "utf-8")).data as Record<string, unknown>;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(
			`[plan-parser] master frontmatter unreadable in ${masterPath}: ${message}\n`,
		);
		return null;
	}
}

/**
 * Read the plan hierarchy declarations from a planning directory.
 *
 * Never throws and never reports a plan: a missing file, absent key, or
 * malformed YAML each degrade to empty, which renders as today's flat list.
 * Losing structure is acceptable; losing a plan is not.
 */
export function readPlanDeclarations(planningDir: string): PlanDeclarations {
	const empty: PlanDeclarations = { parents: [], roadmap: [], subplans: {} };
	if (!existsSync(planningDir)) return empty;

	const rootData = readMasterFrontmatter(join(planningDir, "master.md"));
	const parents = rootData ? stringArray(rootData, "parents") : [];
	const roadmap = rootData ? stringArray(rootData, "roadmap") : [];

	// A folder's own master.md is what makes it a parent in practice, so read
	// every candidate — those named in `parents:` plus any plan carrying a
	// master.md — and let the presence of children decide. This keeps a stale
	// `parents:` entry from suppressing a real declaration, and vice versa.
	const candidates = new Set(parents);
	try {
		for (const entry of readdirSync(planningDir, { withFileTypes: true })) {
			if (entry.isDirectory() && existsSync(join(planningDir, entry.name, "master.md"))) {
				candidates.add(entry.name);
			}
		}
	} catch {
		// Unreadable planning dir — fall through with whatever `parents:` gave us.
	}

	const subplans: Record<string, string[]> = {};
	for (const parent of candidates) {
		const data = readMasterFrontmatter(join(planningDir, parent, "master.md"));
		if (!data) continue;
		subplans[parent] = stringArray(data, "subplans");
	}

	return { parents, roadmap, subplans };
}

export function parseAllPlans(projectRoot: string): PlanSummary[] {
	const planningDir = getPlanningDir(projectRoot);
	if (!existsSync(planningDir)) return [];

	return readdirSync(planningDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => {
			try {
				return parsePlan(join(planningDir, d.name));
			} catch (err) {
				// Defense-in-depth: parsePlan should never throw post-1.31.6 (the
				// frontmatter parser catches YAML errors and returns a malformed
				// PlanSummary). If something else fails (filesystem race,
				// unexpected I/O error), return a placeholder so one broken plan
				// doesn't take down the whole list.
				const message = err instanceof Error ? err.message : String(err);
				process.stderr.write(`[plan-parser] error parsing ${d.name}: ${message}\n`);
				return {
					name: d.name,
					stage: "malformed" as const,
					stageStatus: "parse-error",
					nextStep: `Fix plan directory ${d.name}: ${message}`,
					dependencies: [],
					documents: [],
					parseError: { file: join(planningDir, d.name), message },
				};
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}
