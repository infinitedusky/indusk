import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface PlanFrontmatter {
	title: string;
	date: string;
	status: string;
}

export type PlanStage = "research" | "brief" | "adr" | "impl" | "retrospective" | "unknown";

export interface PlanSummary {
	name: string;
	stage: PlanStage;
	stageStatus: string;
	nextStep: string;
	dependencies: string[];
	documents: string[];
}

const STAGE_ORDER: PlanStage[] = ["research", "brief", "adr", "impl", "retrospective"];

function parseFrontmatter(filePath: string): PlanFrontmatter | null {
	if (!existsSync(filePath)) return null;
	const raw = readFileSync(filePath, "utf-8");
	const { data } = matter(raw);
	return {
		title: (data.title as string) ?? "",
		date: (data.date as string) ?? "",
		status: (data.status as string) ?? "",
	};
}

function parseDependsOn(filePath: string): string[] {
	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, "utf-8");
	const depsMatch = content.match(/## Depends On\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
	if (!depsMatch) return [];

	const deps: string[] = [];
	for (const line of depsMatch[1].split("\n")) {
		const match = line.match(/^-\s+`?planning\/([^/`]+)\/?`?/);
		if (match) {
			deps.push(match[1]);
		}
	}
	return deps;
}

function determineStage(
	planDir: string,
	docs: string[],
): { stage: PlanStage; stageStatus: string } {
	// Walk stages in reverse to find the most advanced document
	for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
		const stage = STAGE_ORDER[i];
		const file = `${stage}.md`;
		if (docs.includes(file)) {
			const fm = parseFrontmatter(join(planDir, file));
			return { stage, stageStatus: fm?.status ?? "unknown" };
		}
	}
	return { stage: "unknown", stageStatus: "unknown" };
}

function determineNextStep(stage: PlanStage, stageStatus: string): string {
	if (stage === "unknown") return "Create a brief";

	const idx = STAGE_ORDER.indexOf(stage);

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

	const { stage, stageStatus } = determineStage(planDir, entries);
	const dependencies = parseDependsOn(join(planDir, "brief.md"));
	const nextStep = determineNextStep(stage, stageStatus);

	return {
		name,
		stage,
		stageStatus,
		nextStep,
		dependencies,
		documents: entries,
	};
}

export function parseAllPlans(projectRoot: string): PlanSummary[] {
	const planningDir = join(projectRoot, "planning");
	if (!existsSync(planningDir)) return [];

	return readdirSync(planningDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => parsePlan(join(planningDir, d.name)))
		.sort((a, b) => a.name.localeCompare(b.name));
}
