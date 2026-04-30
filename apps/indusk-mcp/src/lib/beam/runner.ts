/**
 * Pipeline runner — executes beam query steps and assembles results.
 *
 * Queries run in two groups:
 * - Group A (independent): anchor-lookup, target-facts, eval-findings
 * - Group B (needs neighbors): structural-neighbors first, then neighbor-facts
 */

import { basename, isAbsolute, join, relative } from "node:path";
import { BEAM_PIPELINE } from "./pipeline.js";
import type { BeamItem, BeamResult, BeamTraceStep, QueryContext } from "./types.js";

export interface BeamOptions {
	projectRoot: string;
	targetPath: string;
	trace?: boolean;
}

export async function runBeam(opts: BeamOptions): Promise<BeamResult> {
	const start = Date.now();
	const projectName = basename(opts.projectRoot);

	// Resolve both absolute and relative forms of the target path
	const absolutePath = isAbsolute(opts.targetPath)
		? opts.targetPath
		: join(opts.projectRoot, opts.targetPath);
	const relativePath = isAbsolute(opts.targetPath)
		? relative(opts.projectRoot, opts.targetPath)
		: opts.targetPath;

	const ctx: QueryContext = {
		projectRoot: opts.projectRoot,
		projectName,
		targetPath: opts.targetPath,
		targetAbsolutePath: absolutePath,
		targetRelativePath: relativePath,
		neighbors: [],
		trace: opts.trace ?? false,
	};

	const allItems: BeamItem[] = [];
	const traceSteps: BeamTraceStep[] = [];

	// Group A: independent queries (anchor-lookup, target-facts, eval-findings)
	const groupA = BEAM_PIPELINE.filter(
		(s) => s.name === "anchor-lookup" || s.name === "target-facts" || s.name === "eval-findings",
	);

	// Group B1: structural-neighbors (must run before neighbor-facts)
	const structuralStep = BEAM_PIPELINE.find((s) => s.name === "structural-neighbors");

	// Group B2: depends on neighbors
	const groupB2 = BEAM_PIPELINE.filter((s) => s.name === "neighbor-facts");

	// Run Group A in parallel
	const groupAResults = await Promise.all(
		groupA.map(async (step) => {
			const stepStart = Date.now();
			try {
				const items = await step.execute(ctx);
				if (ctx.trace) {
					traceSteps.push({
						query: step.name,
						source: step.source,
						durationMs: Date.now() - stepStart,
						resultCount: items.length,
						results: items.map((i) => i.content.slice(0, 100)),
					});
				}
				return items;
			} catch {
				if (ctx.trace) {
					traceSteps.push({
						query: step.name,
						source: step.source,
						durationMs: Date.now() - stepStart,
						resultCount: 0,
						results: ["(query failed)"],
					});
				}
				return [];
			}
		}),
	);
	for (const items of groupAResults) allItems.push(...items);

	// Run structural-neighbors (populates ctx.neighbors)
	if (structuralStep) {
		const stepStart = Date.now();
		try {
			const items = await structuralStep.execute(ctx);
			allItems.push(...items);
			if (ctx.trace) {
				traceSteps.push({
					query: structuralStep.name,
					source: structuralStep.source,
					durationMs: Date.now() - stepStart,
					resultCount: items.length,
					results: items.map((i) => i.content.slice(0, 100)),
				});
			}
		} catch {
			if (ctx.trace) {
				traceSteps.push({
					query: structuralStep.name,
					source: structuralStep.source,
					durationMs: Date.now() - stepStart,
					resultCount: 0,
					results: ["(query failed)"],
				});
			}
		}
	}

	// Run Group B2 in parallel (now that neighbors are populated)
	const groupB2Results = await Promise.all(
		groupB2.map(async (step) => {
			const stepStart = Date.now();
			try {
				const items = await step.execute(ctx);
				if (ctx.trace) {
					traceSteps.push({
						query: step.name,
						source: step.source,
						durationMs: Date.now() - stepStart,
						resultCount: items.length,
						results: items.map((i) => i.content.slice(0, 100)),
					});
				}
				return items;
			} catch {
				if (ctx.trace) {
					traceSteps.push({
						query: step.name,
						source: step.source,
						durationMs: Date.now() - stepStart,
						resultCount: 0,
						results: ["(query failed)"],
					});
				}
				return [];
			}
		}),
	);
	for (const items of groupB2Results) allItems.push(...items);

	// Assembly: sort by distance (0 first), then eval findings first, then by timestamp (recent first)
	allItems.sort((a, b) => {
		if (a.distance !== b.distance) return a.distance - b.distance;
		if (a.source === "eval" && b.source !== "eval") return -1;
		if (b.source === "eval" && a.source !== "eval") return 1;
		const aTime = a.metadata.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
		const bTime = b.metadata.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
		return bTime - aTime;
	});

	return {
		target: opts.targetPath,
		items: allItems,
		trace: ctx.trace ? traceSteps : undefined,
		durationMs: Date.now() - start,
	};
}
