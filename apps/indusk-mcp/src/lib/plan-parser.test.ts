import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAllPlans, parsePlan } from "./plan-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parsePlan", () => {
	it("parses the gsd-inspired-improvements plan", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gsd-inspired-improvements"));
		expect(plan.name).toBe("gsd-inspired-improvements");
		expect(plan.stage).toBe("retrospective");
		expect(plan.documents).toContain("brief.md");
		expect(plan.documents).toContain("adr.md");
		expect(plan.documents).toContain("impl.md");
		expect(plan.documents).toContain("retrospective.md");
	});

	it("extracts dependencies from brief", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gsd-inspired-improvements"));
		expect(plan.dependencies.length).toBeGreaterThanOrEqual(0);
	});

	it("parses an archived completed plan", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gate-policy-enforcement"));
		expect(plan.stage).toBe("retrospective");
	});
});

describe("parseAllPlans", () => {
	it("returns all plans sorted by name", () => {
		const plans = parseAllPlans(projectRoot);
		expect(plans.length).toBeGreaterThanOrEqual(2);

		const names = plans.map((p) => p.name);
		// Use stable active plans that exist in the root planning dir (not archived).
		// Both are parked/long-term plans unlikely to be archived in the near term.
		expect(names).toContain("indusk-v2-dawn");
		expect(names).toContain("react-native-support");

		// Verify sorted
		const sorted = [...names].sort();
		expect(names).toEqual(sorted);
	});

	it("returns empty array for missing planning dir", () => {
		const plans = parseAllPlans("/tmp/nonexistent-project");
		expect(plans).toEqual([]);
	});
});

describe("malformed-frontmatter tolerance (1.31.6)", () => {
	let tmpRoot: string;

	beforeEach(() => {
		tmpRoot = mkdtempSync(join(tmpdir(), "plan-parser-malformed-"));
		mkdirSync(join(tmpRoot, ".indusk"), { recursive: true });
		writeFileSync(
			join(tmpRoot, ".indusk/config.json"),
			JSON.stringify({ planning_dir: ".indusk/planning" }),
		);
		mkdirSync(join(tmpRoot, ".indusk/planning"), { recursive: true });
	});

	afterEach(() => {
		rmSync(tmpRoot, { recursive: true, force: true });
	});

	it("returns a 'malformed' plan summary for unquoted-colon frontmatter (does NOT throw)", () => {
		const planDir = join(tmpRoot, ".indusk/planning/bad-yaml");
		mkdirSync(planDir, { recursive: true });
		// Unquoted colon in title — the Numero 'migrate to Solana as soon as:' bug shape.
		writeFileSync(
			join(planDir, "brief.md"),
			`---\ntitle: migrate to Solana as soon as: feasible\nstatus: draft\n---\n\n# Brief body`,
		);

		const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		const plan = parsePlan(planDir);
		errSpy.mockRestore();

		expect(plan.name).toBe("bad-yaml");
		expect(plan.stage).toBe("malformed");
		expect(plan.stageStatus).toBe("parse-error");
		expect(plan.parseError).toBeDefined();
		expect(plan.parseError?.file).toContain("brief.md");
		expect(plan.nextStep).toMatch(/^Fix YAML frontmatter at/);
	});

	it("one malformed plan does NOT poison parseAllPlans — other plans still appear", () => {
		// Good plan
		const goodDir = join(tmpRoot, ".indusk/planning/good-plan");
		mkdirSync(goodDir, { recursive: true });
		writeFileSync(
			join(goodDir, "brief.md"),
			`---\ntitle: A clean plan\nstatus: draft\n---\n\n# OK`,
		);

		// Malformed plan
		const badDir = join(tmpRoot, ".indusk/planning/bad-plan");
		mkdirSync(badDir, { recursive: true });
		writeFileSync(
			join(badDir, "brief.md"),
			`---\ntitle: unquoted: colon: chain: of: doom\nstatus: draft\n---\n\n# Broken`,
		);

		const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
		const plans = parseAllPlans(tmpRoot);
		errSpy.mockRestore();

		expect(plans.map((p) => p.name).sort()).toEqual(["bad-plan", "good-plan"]);
		const good = plans.find((p) => p.name === "good-plan");
		const bad = plans.find((p) => p.name === "bad-plan");
		expect(good?.stage).toBe("brief");
		expect(bad?.stage).toBe("malformed");
		expect(bad?.parseError).toBeDefined();
	});
});
