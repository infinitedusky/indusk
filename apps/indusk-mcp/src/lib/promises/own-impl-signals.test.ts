// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBriefContract } from "./brief-contract.js";
import { afterLandingClauseRows, levelledRows, missingSignalTasks } from "./clause-signal-rules.js";
import { readImpl } from "./rows.js";

/**
 * a-run-can-be-trusted A85: this plan's own brief and impl pass the two rules when the rule
 * functions are run on them directly, whatever the impl's status. The contract check judges
 * only a draft impl on save (Decision 9), and this impl is approved by the time anything
 * could ask it, so the plan holds itself to its own rule here.
 */

const PLAN = "a-run-can-be-trusted";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const folder = [
	join(repoRoot, ".indusk", "planning", PLAN),
	join(repoRoot, ".indusk", "planning", "archive", PLAN),
].find((dir) => existsSync(join(dir, "impl.md")));

describe("A85 — this plan's own documents pass its own rules", () => {
	it("the plan's folder is found, active or archived", () => {
		expect(folder, `no ${PLAN} folder under .indusk/planning/ or its archive/`).toBeDefined();
	});

	it("every split and limit clause of the brief has a task naming its signal and the source that reports it", () => {
		const brief = parseBriefContract(readFileSync(join(folder as string, "brief.md"), "utf-8"));
		expect(brief.shape).toBe("contract");
		if (brief.shape !== "contract") return;
		expect(brief.clausesRequired).toBe(true);
		// Fourteen split and limit clauses (Decision 18): an empty read must not pass as "none missing".
		const provable = brief.makes.flatMap((m) => m.clauses.filter((c) => c.kind !== "rests-on"));
		expect(provable).toHaveLength(14);
		const impl = readFileSync(join(folder as string, "impl.md"), "utf-8");
		expect(missingSignalTasks(brief, impl)).toEqual([]);
	});

	it("no live check, smoke or promise row names a clause as its proof", () => {
		const impl = readImpl(readFileSync(join(folder as string, "impl.md"), "utf-8"));
		expect(impl.ok).toBe(true);
		if (!impl.ok) return;
		expect(impl.trajectory.rows.length).toBeGreaterThan(0);
		expect(afterLandingClauseRows(levelledRows(impl.trajectory))).toEqual([]);
	});
});

// promise: a-plan-with-clauses-carries-its-signals
