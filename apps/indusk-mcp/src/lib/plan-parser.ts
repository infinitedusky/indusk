import { createHash } from "node:crypto";
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
	| "paper"
	| "unknown"
	| "malformed";

/**
 * Papers — prose documents that declare `kind: paper` in frontmatter and live
 * beside (or instead of) the lifecycle documents. Declared, never inferred
 * from filenames: a thesis, a shape document, and an essay can all be papers,
 * and nothing about a name says which. See `.indusk/planning/writing-skill/adr.md`.
 */
export const PAPER_STATUSES = ["draft", "accepted", "published"] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number] | "malformed";

export interface PaperSummary {
	file: string;
	title: string;
	/** `malformed` when the status is outside the vocabulary — never silently a draft. */
	status: PaperStatus;
	/**
	 * Derived on every read, never stored: the paper is published and its
	 * content no longer matches the hash the publish recorded (or no hash was
	 * recorded, which cannot be confirmed current and so reads stale).
	 */
	stale: boolean;
}

export interface PlanSummary {
	name: string;
	stage: PlanStage;
	stageStatus: string;
	nextStep: string;
	dependencies: string[];
	documents: string[];
	/** Every document declaring `kind: paper`, in filename order. Absent when there are none. */
	papers?: PaperSummary[];
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

/**
 * The content hash a publish records and staleness compares against.
 *
 * Hashes the document with `status` and the `published` block removed, so
 * writing either back after a publish does not change what it hashes; a
 * publish computes this on the pre-write content and the next read computes
 * it on the written file and gets the same answer.
 */
export function paperContentHash(raw: string): string {
	const { data, content } = matter(raw);
	const rest: Record<string, unknown> = { ...data };
	delete rest.published;
	delete rest.status;
	return `sha256:${createHash("sha256").update(matter.stringify(content, rest)).digest("hex")}`;
}

function isPaperStatus(value: unknown): value is (typeof PAPER_STATUSES)[number] {
	return typeof value === "string" && (PAPER_STATUSES as readonly string[]).includes(value);
}

/**
 * One document read as a paper; null when it does not declare `kind: paper`.
 * A document whose frontmatter cannot be parsed cannot declare anything, so
 * it is not a paper here — the lifecycle walk reports it if it is a lifecycle
 * document, and the admin's raw view shows it either way.
 */
function readPaper(planDir: string, file: string): PaperSummary | null {
	const raw = readFileSync(join(planDir, file), "utf-8");
	let data: Record<string, unknown>;
	try {
		data = matter(raw).data as Record<string, unknown>;
	} catch {
		return null;
	}
	if (data.kind !== "paper") return null;
	const status: PaperStatus = isPaperStatus(data.status) ? data.status : "malformed";
	const published = data.published as { hash?: unknown } | undefined;
	const recorded = typeof published?.hash === "string" ? published.hash : null;
	const stale = status === "published" && (recorded === null || recorded !== paperContentHash(raw));
	return { file, title: typeof data.title === "string" ? data.title : file, status, stale };
}

const PAPER_STATUS_ORDER: Record<PaperStatus, number> = {
	malformed: 0,
	draft: 1,
	accepted: 2,
	published: 3,
};

/** The least-advanced paper's status; `malformed` outranks everything so it surfaces. */
function leastAdvancedPaperStatus(papers: PaperSummary[]): PaperStatus {
	return papers.reduce<PaperStatus>(
		(least, p) => (PAPER_STATUS_ORDER[p.status] < PAPER_STATUS_ORDER[least] ? p.status : least),
		"published",
	);
}

function paperNextStep(papers: PaperSummary[]): string {
	const malformed = papers.find((p) => p.status === "malformed");
	if (malformed) {
		return `Fix paper status in ${malformed.file} (expected ${PAPER_STATUSES.join(" | ")})`;
	}
	const draft = papers.find((p) => p.status === "draft");
	if (draft) return `Review paper: ${draft.file}`;
	const owed = papers.filter((p) => p.status === "accepted" || p.stale).length;
	if (owed > 0) return `Publish ${owed} paper(s)`;
	return "Done";
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

	const walked = determineStage(planDir, entries);
	const dependencies = parseDependsOn(join(planDir, "brief.md"));
	const papers = entries
		.map((file) => readPaper(planDir, file))
		.filter((p): p is PaperSummary => p !== null);

	// A lifecycle document wins the stage; papers ride alongside it. Only a
	// folder with no lifecycle document at all is a paper-stage plan, so no
	// existing plan changes stage by gaining a paper.
	const paperStage = walked.stage === "unknown" && papers.length > 0;
	const stage: PlanStage = paperStage ? "paper" : walked.stage;
	const stageStatus = paperStage ? leastAdvancedPaperStatus(papers) : walked.stageStatus;
	const nextStep = paperStage
		? paperNextStep(papers)
		: determineNextStep(walked.stage, walked.stageStatus, walked.parseError);

	return {
		name,
		stage,
		stageStatus,
		nextStep,
		dependencies,
		documents: entries,
		...(papers.length > 0 && { papers }),
		...(walked.parseError && { parseError: walked.parseError }),
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
