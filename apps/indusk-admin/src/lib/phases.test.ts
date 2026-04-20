import { describe, expect, it } from "vitest";
import {
	extractChecklistItems,
	extractPhases,
	splitPhasesAroundFalsification,
} from "./phases";

/**
 * T26 — `splitPhasesAroundFalsification` detects the falsification phase by
 *       title substring (case-insensitive "Falsification") and splits the
 *       phase list into pre / falsification / post groups so PlanDetail can
 *       render them in their own sections.
 *
 *       `extractChecklistItems` pulls `- [ ] / - [x]` items from phase
 *       markdown content for the falsification-fix-items rendering.
 */

describe("splitPhasesAroundFalsification — T26", () => {
	it("splits pre/falsification/post when the falsification phase is in the middle", () => {
		const impl = `
### Phase 1: First regular
Some content.

### Phase 2: Another regular
More content.

### Phase 3: Falsification — hypotheses
- [ ] fix one

### Phase 4: Follow-up fix
More fixes.
`;
		const phases = extractPhases(impl);
		const split = splitPhasesAroundFalsification(phases);
		expect(split.pre.map((p) => p.number)).toEqual([1, 2]);
		expect(split.falsification?.number).toBe(3);
		expect(split.post.map((p) => p.number)).toEqual([4]);
	});

	it("returns all phases as pre when no falsification phase is present", () => {
		const impl = `
### Phase 1: A
content

### Phase 2: B
content
`;
		const phases = extractPhases(impl);
		const split = splitPhasesAroundFalsification(phases);
		expect(split.pre.map((p) => p.number)).toEqual([1, 2]);
		expect(split.falsification).toBeNull();
		expect(split.post).toEqual([]);
	});

	it("returns empty post when the falsification phase is the last phase", () => {
		const impl = `
### Phase 1: Regular
content

### Phase 2: Falsification — hardening
- [ ] item
`;
		const phases = extractPhases(impl);
		const split = splitPhasesAroundFalsification(phases);
		expect(split.pre.map((p) => p.number)).toEqual([1]);
		expect(split.falsification?.number).toBe(2);
		expect(split.post).toEqual([]);
	});

	it("detects the falsification phase case-insensitively", () => {
		const impl = `
### Phase 1: FALSIFICATION — uppercase edition
content

### Phase 2: Regular follow-up
content
`;
		const phases = extractPhases(impl);
		const split = splitPhasesAroundFalsification(phases);
		expect(split.falsification?.number).toBe(1);
		expect(split.post.map((p) => p.number)).toEqual([2]);
	});

	it("uses the FIRST matching phase when multiple have 'Falsification' in the title", () => {
		// Unlikely in practice but specified behavior
		const impl = `
### Phase 1: Regular
content

### Phase 2: Falsification — first
content

### Phase 3: Regular
content

### Phase 4: Falsification — second
content
`;
		const phases = extractPhases(impl);
		const split = splitPhasesAroundFalsification(phases);
		expect(split.falsification?.number).toBe(2);
		// Phases 3 and 4 go to post
		expect(split.post.map((p) => p.number)).toEqual([3, 4]);
	});
});

describe("extractChecklistItems — T26", () => {
	it("parses unchecked and checked items with their text", () => {
		const md = `Some preamble.

- [ ] first item
- [x] second item completed
- [ ] third item

Trailing prose.`;
		const items = extractChecklistItems(md);
		expect(items).toEqual([
			{ text: "first item", checked: false },
			{ text: "second item completed", checked: true },
			{ text: "third item", checked: false },
		]);
	});

	it("returns an empty array when there are no checklist items", () => {
		const md = `Just prose. No items.`;
		expect(extractChecklistItems(md)).toEqual([]);
	});

	it("ignores malformed checkbox syntax", () => {
		const md = `- [X] uppercase is NOT accepted (contract is lowercase x)
- [] no space between brackets
- [ no closing bracket
- [ ] valid item`;
		const items = extractChecklistItems(md);
		expect(items).toEqual([{ text: "valid item", checked: false }]);
	});
});
