/**
 * Format beam results as markdown for agent consumption.
 */

import type { BeamResult } from "./types.js";

export function formatBeamMarkdown(result: BeamResult): string {
	const lines: string[] = [];
	lines.push(`## Context for ${result.target}\n`);

	// Distance 0 items
	const d0 = result.items.filter((i) => i.distance === 0);
	if (d0.length > 0) {
		lines.push("### This file (distance 0)\n");
		for (const item of d0) {
			const prefix = item.source === "eval" ? "⚠" : "•";
			lines.push(`${prefix} **${item.source}**: ${item.content}`);
		}
		lines.push("");
	}

	// Distance 1 items grouped by source
	const d1 = result.items.filter((i) => i.distance === 1);
	if (d1.length > 0) {
		const structural = d1.filter((i) => i.source === "semantic-graph");
		const facts = d1.filter((i) => i.source === "graphiti");
		const cgc = d1.filter((i) => i.source === "cgc");

		if (structural.length > 0) {
			lines.push("### Structural neighbors (distance 1)\n");
			for (const item of structural) {
				lines.push(`- ${item.content}`);
			}
			lines.push("");
		}

		if (facts.length > 0) {
			lines.push("### Neighbor facts\n");
			for (const item of facts) {
				lines.push(`- ${item.content}`);
			}
			lines.push("");
		}

		if (cgc.length > 0) {
			lines.push("### Function dependencies\n");
			for (const item of cgc) {
				lines.push(`- ${item.content}`);
			}
			lines.push("");
		}
	}

	// Distance 2 items
	const d2 = result.items.filter((i) => i.distance === 2);
	if (d2.length > 0) {
		lines.push("### Extended context (distance 2)\n");
		for (const item of d2) {
			lines.push(`- ${item.content}`);
		}
		lines.push("");
	}

	lines.push(`*${result.items.length} items, ${result.durationMs}ms*`);
	return lines.join("\n");
}

export function formatBeamCompact(result: BeamResult): string {
	const lines: string[] = [];
	lines.push(`📡 [beam] ${result.target}`);

	const d0 = result.items.filter((i) => i.distance === 0);
	for (const item of d0) {
		const prefix = item.source === "eval" ? "  ⚠" : "  •";
		lines.push(`${prefix} ${item.content}`);
	}

	const neighbors = result.items
		.filter((i) => i.distance === 1 && i.source === "semantic-graph")
		.map((i) => i.metadata.path?.split("/").pop() ?? "")
		.filter(Boolean);
	if (neighbors.length > 0) {
		lines.push(`  → neighbors: ${neighbors.join(", ")}`);
	}

	return lines.join("\n");
}

export function formatBeamTrace(result: BeamResult): string {
	if (!result.trace) return "(no trace data)";

	const lines: string[] = [];
	lines.push(`[beam] target: ${result.target}\n`);

	for (const step of result.trace) {
		lines.push(`[${step.query}] ${step.source} (${step.durationMs}ms)`);
		lines.push(`  → ${step.resultCount} results`);
		for (const r of step.results) {
			lines.push(`    - ${r}`);
		}
		lines.push("");
	}

	lines.push(
		`[assembly] ${result.items.length} items total — ${result.items.filter((i) => i.distance === 0).length} high-signal (d0), ${result.items.filter((i) => i.distance === 1).length} awareness (d1)`,
	);
	lines.push(`[timing] ${result.durationMs}ms total`);

	return lines.join("\n");
}
