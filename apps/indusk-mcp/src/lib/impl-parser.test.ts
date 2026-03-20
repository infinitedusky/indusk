import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllPhaseCompletions, parseImpl, parseImplString } from "./impl-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parseImpl", () => {
	it("parses the document-skill impl", () => {
		const parsed = parseImpl(join(projectRoot, "planning/document-skill/impl.md"));
		expect(parsed.title).toContain("Document");
		expect(parsed.status).toBe("completed");
		expect(parsed.phases.length).toBeGreaterThanOrEqual(2);
	});

	it("parses the mcp-dev-system impl", () => {
		const parsed = parseImpl(join(projectRoot, "planning/mcp-dev-system/impl.md"));
		expect(parsed.status).toBe("completed");
		expect(parsed.phases.length).toBeGreaterThanOrEqual(7);

		// Phase 1 should be fully checked
		const phase1 = parsed.phases[0];
		expect(phase1.number).toBe(1);
		expect(phase1.name).toContain("Package Structure");
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
		const parsed = parseImpl(join(projectRoot, "planning/mcp-dev-system/impl.md"));
		const completions = getAllPhaseCompletions(parsed);

		// Early phases should be complete
		expect(completions[0].complete).toBe(true);
		expect(completions[1].complete).toBe(true);

		// All phases should be complete now
		const lastPhase = completions[completions.length - 1];
		expect(lastPhase.complete).toBe(true);
	});
});
