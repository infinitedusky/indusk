// promise: a-finished-ritual-stays-done
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import {
	checkRetrospectiveReadiness,
	finishedRitualsOf,
	isCleanupPhaseTerminal,
	isCleanupSkipped,
} from "../lib/cleanup/gate.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import { type PromiseProject, promiseProject } from "./helpers/promises-fixture.js";

/**
 * Cleanup-ritual Phase 3 — the retrospective Step 0 gate helpers.
 *
 * T2  — an unrun (or absent) Cleanup phase is NOT complete.
 * T3  — a terminal Cleanup phase (all items checked) IS complete.
 * T4  — `cleanup: skipped` + non-empty `cleanup_reason` is a skip; missing/empty
 *       reason or wrong flag is not.
 * A17 — promise: a-plan-holds-the-promises-it-lands: a plan whose second
 *       promise has a clause resting on its first passes the promises gate.
 * T13 — the composed gate passes only when BOTH falsification AND cleanup are
 *       satisfied; satisfying one alone still blocks.
 */

const CLEANUP_PHASE_UNCHECKED = `## Checklist

### Phase 6: Cleanup — decompose the table

- [ ] extract Chip into its own file

#### Phase 6 Verification
- [ ] T1 passes
`;

const CLEANUP_PHASE_CHECKED = `## Checklist

### Phase 6: Cleanup — decompose the table

- [x] extract Chip into its own file

#### Phase 6 Verification
- [x] T1 passes
`;

const NO_CLEANUP_PHASE = `## Checklist

### Phase 1: Config

- [x] do the thing
`;

describe("cleanup-ritual T2/T3: Cleanup-phase terminal detection", () => {
	it("T2: an unrun Cleanup phase (unchecked items) is not terminal", () => {
		expect(isCleanupPhaseTerminal(CLEANUP_PHASE_UNCHECKED)).toBe(false);
	});
	it("T2: an impl with no Cleanup phase is not terminal", () => {
		expect(isCleanupPhaseTerminal(NO_CLEANUP_PHASE)).toBe(false);
	});
	it("T3: a Cleanup phase with all items checked is terminal", () => {
		expect(isCleanupPhaseTerminal(CLEANUP_PHASE_CHECKED)).toBe(true);
	});
});

describe("cleanup-ritual T4: cleanup skip frontmatter", () => {
	it("accepts `cleanup: skipped` with a non-empty reason", () => {
		const content = `---\ncleanup: skipped\ncleanup_reason: "trivial changelog-only plan"\n---\n\nbody`;
		expect(isCleanupSkipped(content)).toEqual({
			skipped: true,
			reason: "trivial changelog-only plan",
		});
	});
	it("rejects `cleanup: skipped` with no reason", () => {
		const content = `---\ncleanup: skipped\n---\n\nbody`;
		expect(isCleanupSkipped(content).skipped).toBe(false);
	});
	it("rejects `cleanup: skipped` with an empty reason", () => {
		const content = `---\ncleanup: skipped\ncleanup_reason: "   "\n---\n\nbody`;
		expect(isCleanupSkipped(content).skipped).toBe(false);
	});
	it("rejects a non-skipped flag", () => {
		const content = `---\ncleanup: required\ncleanup_reason: "x"\n---\n\nbody`;
		expect(isCleanupSkipped(content).skipped).toBe(false);
	});
});

describe("cleanup-ritual T13: retrospective gate requires BOTH rituals", () => {
	function planWith(frontmatter: string, checklist: string): { planRoot: string; content: string } {
		const dir = mkdtempSync(join(tmpdir(), "cleanup-gate-"));
		const content = `---\n${frontmatter}\n---\n\n${checklist}`;
		writeFileSync(join(dir, "impl.md"), content);
		return { planRoot: dir, content };
	}

	it("passes when both falsification and cleanup are satisfied (both skipped)", () => {
		const { planRoot, content } = planWith(
			// the audit (plan-review-subagent) is satisfied by its skip pair, so only the two rituals are under test
			`falsification: skipped\nfalsification_reason: "nothing to falsify"\ncleanup: skipped\ncleanup_reason: "nothing to extract"\naudit: skipped\naudit_reason: "not under test"`,
			NO_CLEANUP_PHASE,
		);
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(true);
		expect(r.missing).toEqual([]);
	});

	it("blocks when only falsification is satisfied (cleanup missing)", () => {
		const { planRoot, content } = planWith(
			`falsification: skipped\nfalsification_reason: "nothing to falsify"`,
			NO_CLEANUP_PHASE,
		);
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("cleanup");
	});

	it("blocks when only cleanup is satisfied (falsification missing)", () => {
		const { planRoot, content } = planWith(
			`cleanup: skipped\ncleanup_reason: "nothing to extract"`,
			NO_CLEANUP_PHASE,
		);
		const r = checkRetrospectiveReadiness(planRoot, content);
		expect(r.passes).toBe(false);
		expect(r.missing).toContain("falsification");
	});
});

describe("cleanup-ritual T18: Cleanup-phase detection anchors on the title start", () => {
	it("a phase merely MENTIONING cleanup ('The /cleanup skill') is NOT the ritual phase", () => {
		const impl = `## Checklist

### Phase 4: The /cleanup skill

- [x] author the skill

#### Phase 4 Verification
- [x] T9 passes
`;
		// substring detection would wrongly return true (all items checked)
		expect(isCleanupPhaseTerminal(impl)).toBe(false);
	});

	it("a phase titled 'Cleanup — {summary}' IS the ritual phase", () => {
		const impl = `## Checklist

### Phase 6: Cleanup — decompose the table

- [x] extract Chip into its own file
`;
		expect(isCleanupPhaseTerminal(impl)).toBe(true);
	});
});

describe("cleanup-ritual T23: an empty Cleanup phase is not vacuously terminal", () => {
	it("a Cleanup heading with zero checklist items does NOT satisfy the gate", () => {
		const impl = `## Checklist

### Phase 7: Cleanup — decompose

(no items were authored)
`;
		// Rubber-stamp vector: author an empty phase, gate passes. Must be false.
		expect(isCleanupPhaseTerminal(impl)).toBe(false);
	});
});

describe("cleanup-ritual T24: nested unchecked items block terminality", () => {
	it("an indented unchecked sub-item keeps the Cleanup phase non-terminal", () => {
		const impl = `## Checklist

### Phase 7: Cleanup — decompose

- [x] top-level item done
  - [ ] nested sub-item NOT done
`;
		expect(isCleanupPhaseTerminal(impl)).toBe(false);
	});
});

describe("cleanup-ritual T20: gate honors the phase-authored falsification flow", () => {
	it("falsificationOk is true for a terminal Falsification phase (no log, not skipped)", () => {
		const dir = mkdtempSync(join(tmpdir(), "cleanup-fals-"));
		const content = `---\ntitle: "P"\n---\n\n## Checklist\n\n### Phase 6: Falsification — hunt\n\n- [x] fix a bug\n\n#### Phase 6 Verification\n- [x] T1 passes\n\n### Phase 7: Cleanup — decompose\n\n- [x] extract a component\n`;
		writeFileSync(join(dir, "impl.md"), content);
		const r = checkRetrospectiveReadiness(dir, content);
		// no falsification.md log, no `falsification: skipped` — only a terminal
		// Falsification phase, which is the DEFAULT flow. Must count as satisfied.
		expect(r.falsificationOk).toBe(true);
	});
});

/**
 * A10 — one definition of "finished": the package's list and the gate's verdict
 * come from the same files, so the plan page and the retrospective cannot disagree.
 */
describe("A10 — finishedRitualsOf agrees with the retrospective gate", () => {
	const impl = (falsify: boolean, cleanup: boolean) =>
		[
			"---",
			'title: "P"',
			"---",
			"",
			"## Checklist",
			"",
			...(falsify ? ["### Build Phase 4: Falsification — hunt", "- [x] hunted", ""] : []),
			...(cleanup ? ["### Build Phase 5: Cleanup — extract", "- [x] extracted", ""] : []),
		].join("\n");

	it("lists a closed falsification phase, a closed cleanup phase and a written audit", () => {
		const root = mkdtempSync(join(tmpdir(), "finished-"));
		writeFileSync(join(root, "audit.md"), "# Audit\n");
		const text = impl(true, true);
		expect(finishedRitualsOf(root, text)).toEqual(["falsification", "cleanup", "audit"]);
		const gate = checkRetrospectiveReadiness(root, text);
		expect([gate.falsificationOk, gate.cleanupOk, gate.auditOk]).toEqual([true, true, true]);
	});

	it("lists only what is finished, and the gate misses the rest", () => {
		const root = mkdtempSync(join(tmpdir(), "finished-"));
		const text = impl(true, false);
		expect(finishedRitualsOf(root, text)).toEqual(["falsification"]);
		const gate = checkRetrospectiveReadiness(root, text);
		expect([gate.falsificationOk, gate.cleanupOk, gate.auditOk]).toEqual([true, false, false]);
	});
});

describe("plans-are-promises A17 — the gate counts a sibling promise as in force", () => {
	let fixture: PromiseProject | null = null;
	afterEach(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		fixture = null;
	});

	const entry = (name: string, restsOn?: string) => ({
		name,
		kind: "structure" as const,
		state: "declared" as const,
		domain: "seating",
		owner: "seats-v2",
		raw: matter.stringify(`The ${name} promise holds.\n\n## History\n- 2026-10-16 — declared.\n`, {
			name,
			kind: "structure",
			lifetime: "holds",
			state: "declared",
			domain: "seating",
			owner: "seats-v2",
			sites: [],
			tests: [],
			incidents: [],
			...(restsOn
				? {
						clauses: [
							{ name: "fast", kind: "split", statement: "Answers fast." },
							{ name: "base", kind: "rests-on", rests_on: restsOn },
						],
					}
				: {}),
		}),
	});

	const FIRST = "first-promise";

	it("is ready when the first is proved by rows and the second rests on it", () => {
		fixture = promiseProject({
			domains: ["seating"],
			promises: [entry("first-promise"), entry("second-promise", "first-promise")],
			planFiles: {
				"seats-v2/brief.md": briefText("seats-v2", {
					makes: [
						{ name: "first-promise", sentence: "The first-promise promise holds." },
						{ name: "second-promise", sentence: "The second-promise promise holds." },
					],
				}),
			},
		});
		const content = implText("seats-v2", {
			keys: ["test_purpose: required"],
			columns: ["For", "Test"],
			rows: [
				{ state: "passing", cells: { For: `promise: ${FIRST}`, Test: "a.test.ts" } },
				{ state: "passing", cells: { For: "clause: second-promise/fast", Test: "b.test.ts" } },
			],
		});
		const r = checkRetrospectiveReadiness(`${fixture.planRoot}/.indusk/planning/seats-v2`, content);
		expect(r.unprovenPromises).toEqual([]);
	});
});
