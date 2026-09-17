import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRetrospectiveReadiness } from "../lib/cleanup/gate.js";
import { parsePlan } from "../lib/plan-parser.js";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * admin-ui-phase-progress — A13, a regression guard.
 *
 * Build Phase 1 moves the stage order and the ritual order into
 * `lib/lifecycle.ts` and has `parsePlan` and `checkRetrospectiveReadiness`
 * read from there. That must change nothing for the plans that exist today —
 * except the one intended change, `test-plan` joining the document positions,
 * which is re-baselined by hand in that phase's Verification, naming each
 * plan whose stage moved.
 *
 * The snapshot is written on first run and compared afterwards. It compares
 * only folders present on both sides, so a plan added or archived later does
 * not fail the guard: it pins the READER's behaviour, not the corpus.
 */

const PLANNING = join(REPO_ROOT, ".indusk/planning");
const SNAPSHOT = join(__dirname, "fixtures/lifecycle-parity.snapshot.json");

interface Observed {
	stage: string;
	stageStatus: string;
	nextStep: string;
	readiness?: { passes: boolean; missing: string[] };
}

function planDirs(): string[] {
	const dirs: string[] = [];
	for (const base of [PLANNING, join(PLANNING, "archive")]) {
		if (!existsSync(base)) continue;
		for (const d of readdirSync(base, { withFileTypes: true })) {
			if (!d.isDirectory() || d.name === "archive") continue;
			dirs.push(join(base, d.name));
		}
	}
	return dirs.sort();
}

function observe(): Record<string, Observed> {
	const out: Record<string, Observed> = {};
	for (const dir of planDirs()) {
		const summary = parsePlan(dir);
		const key = dir.slice(PLANNING.length + 1);
		const observed: Observed = {
			stage: summary.stage,
			stageStatus: summary.stageStatus,
			nextStep: summary.nextStep,
		};
		const impl = join(dir, "impl.md");
		if (existsSync(impl)) {
			const r = checkRetrospectiveReadiness(dir, readFileSync(impl, "utf-8"));
			observed.readiness = { passes: r.passes, missing: r.missing };
		}
		out[key] = observed;
	}
	return out;
}

describe("A13 — parsePlan and checkRetrospectiveReadiness are unchanged over the corpus", () => {
	it("matches the snapshot for every folder present on both sides", () => {
		const now = observe();
		if (!existsSync(SNAPSHOT)) {
			mkdirSync(dirname(SNAPSHOT), { recursive: true });
			writeFileSync(SNAPSHOT, `${JSON.stringify(now, null, 2)}\n`);
			console.info(`lifecycle-parity: wrote baseline for ${Object.keys(now).length} folders`);
			return;
		}
		const baseline = JSON.parse(readFileSync(SNAPSHOT, "utf-8")) as Record<string, Observed>;
		const shared = Object.keys(now).filter((k) => k in baseline);
		expect(shared.length, "no folder is shared with the baseline").toBeGreaterThan(0);
		const diffs = shared
			.filter((k) => JSON.stringify(now[k]) !== JSON.stringify(baseline[k]))
			.map((k) => ({ plan: k, was: baseline[k], now: now[k] }));
		expect(diffs, "reader output changed for these plans").toEqual([]);
	});
});
