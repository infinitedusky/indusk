import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllPhaseCompletions, parseImpl, parseImplString } from "./impl-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parseImpl", () => {
	it("parses the gsd-inspired-improvements impl", () => {
		const parsed = parseImpl(
			join(projectRoot, ".indusk/planning/archive/gsd-inspired-improvements/impl.md"),
		);
		expect(parsed.title).toContain("GSD");
		expect(parsed.phases.length).toBeGreaterThanOrEqual(2);
	});

	it("parses an archived completed impl", () => {
		const parsed = parseImpl(
			join(projectRoot, ".indusk/planning/archive/gate-policy-enforcement/impl.md"),
		);
		expect(parsed.status).toBe("completed");
		expect(parsed.phases.length).toBeGreaterThanOrEqual(1);
	});

	it("returns empty for non-existent file", () => {
		const parsed = parseImpl("/tmp/nonexistent.md");
		expect(parsed.phases).toEqual([]);
	});
});

describe("parseImplString", () => {
	it("parses all four gate types", () => {
		const md = `---
title: "Test"
status: in-progress
---

### Phase 1: Setup

- [x] Do thing A
- [ ] Do thing B

#### Phase 1 Verification
- [x] Check A works
- [ ] Check B works

#### Phase 1 Context
- [x] Update CLAUDE.md

#### Phase 1 Document
- [ ] Write docs
`;
		const parsed = parseImplString(md);
		expect(parsed.phases).toHaveLength(1);

		const phase = parsed.phases[0];
		expect(phase.gates).toHaveLength(4);
		expect(phase.gates[0].type).toBe("implementation");
		expect(phase.gates[0].items).toHaveLength(2);
		expect(phase.gates[1].type).toBe("verification");
		expect(phase.gates[1].items).toHaveLength(2);
		expect(phase.gates[2].type).toBe("context");
		expect(phase.gates[2].items).toHaveLength(1);
		expect(phase.gates[3].type).toBe("document");
		expect(phase.gates[3].items).toHaveLength(1);
	});

	it("handles phases without all gate types", () => {
		const md = `---
title: "Test"
status: completed
---

### Phase 1: Simple

- [x] Just one thing

#### Phase 1 Verification
- [x] It works
`;
		const parsed = parseImplString(md);
		expect(parsed.phases[0].gates).toHaveLength(2);
		expect(parsed.phases[0].gates[0].type).toBe("implementation");
		expect(parsed.phases[0].gates[1].type).toBe("verification");
	});
});

describe("getAllPhaseCompletions", () => {
	it("calculates completion for each phase", () => {
		const md = `---
title: "Test"
status: in-progress
---

### Phase 1: Done

- [x] A
- [x] B

#### Phase 1 Verification
- [x] Works

### Phase 2: Partial

- [x] C
- [ ] D

#### Phase 2 Verification
- [ ] Check D
`;
		const parsed = parseImplString(md);
		const completions = getAllPhaseCompletions(parsed);

		expect(completions).toHaveLength(2);
		expect(completions[0].complete).toBe(true);
		expect(completions[0].checkedItems).toBe(3);
		expect(completions[0].totalItems).toBe(3);

		expect(completions[1].complete).toBe(false);
		expect(completions[1].checkedItems).toBe(1);
		expect(completions[1].totalItems).toBe(3);
		expect(completions[1].uncheckedByGate.implementation).toEqual(["D"]);
		expect(completions[1].uncheckedByGate.verification).toEqual(["Check D"]);
	});

	it("reports completion status from real impl", () => {
		const parsed = parseImpl(
			join(projectRoot, ".indusk/planning/archive/gate-policy-enforcement/impl.md"),
		);
		const completions = getAllPhaseCompletions(parsed);

		// Should have at least one phase
		expect(completions.length).toBeGreaterThanOrEqual(1);
		// Should have both checked and total counts
		expect(completions[0].totalItems).toBeGreaterThan(0);
	});
});

describe("a checklist item's note", () => {
	it("carries the indented lines under an item, and none for an item without any", () => {
		const parsed = parseImplString(
			[
				"### Build Phase 1: X",
				"",
				"- [x] First",
				"  - Note: it was done",
				"    over two lines",
				"- [ ] Second",
			].join("\n"),
		);
		const items = parsed.phases[0].gates[0].items;
		expect(items[0].note).toBe("Note: it was done\nover two lines");
		expect(items[1]).toEqual({ checked: false, text: "Second" });
	});
});

// promise: technical-detail-opens-on-request
describe("phase-summaries A7 — a task's folded detail reaches the page whole", () => {
	const impl = [
		"### Build Phase 1: Placing a component",
		"",
		"**Tier**: med — the work step's default",
		"",
		"This phase makes a placed component put its words in place.",
		"",
		"- [ ] Placing a component puts your words in place",
		"  <details><summary>Technical</summary>",
		"",
		"  `compose` walks each path.",
		"",
		"  ```ts",
		'  compose(snapshot, { title: "Create project" })',
		"  ```",
		"",
		"  </details>",
		"- [ ] A second task with no detail",
	].join("\n");

	it("keeps the detail, fence included, with the wrappers removed", () => {
		const items = parseImplString(impl).phases[0].gates[0].items;
		const detail = (items[0] as { detail?: string }).detail;
		expect(detail, "the first item's detail").toBeDefined();
		expect(detail).toContain("`compose` walks each path.");
		expect(detail).toContain("```ts");
		expect(detail).toContain('compose(snapshot, { title: "Create project" })');
		expect(detail).not.toMatch(/<\/?(details|summary)/);
		expect((items[1] as { detail?: string }).detail).toBeUndefined();
	});

	it("keeps the phase's paragraph", () => {
		const phase = parseImplString(impl).phases[0] as { summary?: string };
		expect(phase.summary).toBe("This phase makes a placed component put its words in place.");
	});
});

/**
 * a-run-can-be-trusted, Build Phase 7 (found by hand 2026-10-19): a phase's Forward
 * Intelligence section ended only at a gate heading, so the next phase's whole task list was
 * read as the previous phase's notes and every build phase parsed with no implementation items.
 */
describe("a phase's Forward Intelligence ends where the next phase begins", () => {
	const impl = [
		"---",
		'title: "p — Impl"',
		"status: in-progress",
		"---",
		"",
		"### Build Phase 1: first",
		"",
		"- [x] Do the first thing.",
		"",
		"#### Build Phase 1 Verification",
		"",
		"- [x] It holds.",
		"",
		"#### Build Phase 1 Forward Intelligence",
		"",
		"- **Decision**: one.",
		"",
		"### Build Phase 2: second",
		"",
		"What the second phase does.",
		"",
		"- [ ] Do the second thing.",
		"- [ ] Do the third thing.",
		"",
		"#### Build Phase 2 Verification",
		"",
		"- [ ] It holds too.",
		"",
		"#### Build Phase 2 Forward Intelligence",
		"",
		"- **Decision**: two.",
		"",
	].join("\n");

	it("parses every phase's tasks, and each phase keeps its own forward intelligence", () => {
		const parsed = parseImplString(impl);
		const [one, two] = parsed.phases;
		const tasks = (p: (typeof parsed.phases)[number]) =>
			p.gates.filter((g) => g.type === "implementation").flatMap((g) => g.items.map((i) => i.text));
		expect(tasks(one)).toEqual(["Do the first thing."]);
		expect(tasks(two)).toEqual(["Do the second thing.", "Do the third thing."]);
		expect(one.forwardIntelligence).toBe("- **Decision**: one.");
		expect(two.forwardIntelligence).toBe("- **Decision**: two.");
		expect(two.summary).toBe("What the second phase does.");
	});
});
