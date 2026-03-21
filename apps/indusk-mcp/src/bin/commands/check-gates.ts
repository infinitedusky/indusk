import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAllPhaseCompletions, parseImpl } from "../../lib/impl-parser.js";

export async function checkGates(
	projectRoot: string,
	options: { file?: string; phase?: number } = {},
): Promise<void> {
	let implPath: string;

	if (options.file) {
		implPath = options.file;
	} else {
		// Find active impl (in-progress status) in planning/
		const planningDir = join(projectRoot, "planning");
		if (!existsSync(planningDir)) {
			console.error("No planning/ directory found");
			process.exitCode = 1;
			return;
		}

		const plans = readdirSync(planningDir, { withFileTypes: true })
			.filter((d) => d.isDirectory() && d.name !== "archive")
			.map((d) => d.name);

		let found: string | null = null;
		for (const plan of plans) {
			const path = join(planningDir, plan, "impl.md");
			if (!existsSync(path)) continue;
			const content = readFileSync(path, "utf-8");
			if (content.includes("status: in-progress")) {
				found = path;
				break;
			}
		}

		if (!found) {
			console.error("No in-progress impl found in planning/");
			process.exitCode = 1;
			return;
		}
		implPath = found;
	}

	if (!existsSync(implPath)) {
		console.error(`File not found: ${implPath}`);
		process.exitCode = 1;
		return;
	}

	const parsed = parseImpl(implPath);
	const completions = getAllPhaseCompletions(parsed);

	if (options.phase) {
		const phase = completions.find((c) => c.phase === options.phase);
		if (!phase) {
			console.error(`Phase ${options.phase} not found`);
			process.exitCode = 1;
			return;
		}
		printPhase(phase);
		process.exitCode = phase.complete ? 0 : 1;
		return;
	}

	// Report all phases
	let allPass = true;
	console.info(`Gate status: ${implPath}\n`);

	for (const phase of completions) {
		printPhase(phase);
		if (!phase.complete) allPass = false;
	}

	// Check for blockers
	for (const phase of parsed.phases) {
		if (phase.blocker) {
			console.info(`  BLOCKER in Phase ${phase.number}: ${phase.blocker}`);
			allPass = false;
		}
	}

	console.info(allPass ? "\nAll gates pass." : "\nSome gates incomplete.");
	process.exitCode = allPass ? 0 : 1;
}

function printPhase(phase: {
	phase: number;
	name: string;
	complete: boolean;
	checkedItems: number;
	totalItems: number;
	uncheckedByGate: Record<string, string[]>;
}): void {
	const status = phase.complete ? "PASS" : "FAIL";
	console.info(
		`Phase ${phase.phase}: ${phase.name} — ${status} (${phase.checkedItems}/${phase.totalItems})`,
	);

	if (!phase.complete) {
		for (const [gate, items] of Object.entries(phase.uncheckedByGate)) {
			for (const item of items) {
				console.info(`  [${gate}] ${item}`);
			}
		}
	}
}
