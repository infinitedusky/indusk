import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	checkRetrospectiveReadiness,
	isCleanupPhaseTerminal,
	isCleanupSkipped,
} from "../lib/cleanup/gate.js";

/**
 * Cleanup-ritual Phase 3 — the retrospective Step 0 gate helpers.
 *
 * T2  — an unrun (or absent) Cleanup phase is NOT complete.
 * T3  — a terminal Cleanup phase (all items checked) IS complete.
 * T4  — `cleanup: skipped` + non-empty `cleanup_reason` is a skip; missing/empty
 *       reason or wrong flag is not.
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
			`falsification: skipped\nfalsification_reason: "nothing to falsify"\ncleanup: skipped\ncleanup_reason: "nothing to extract"`,
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
