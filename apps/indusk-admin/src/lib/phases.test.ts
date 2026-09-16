import { describe, expect, it } from "vitest";
import { extractPhases, splitPhasesAroundFalsification } from "./phases";

/**
 * T26 — `splitPhasesAroundFalsification` detects the falsification phase by
 *       title substring (case-insensitive "Falsification") and splits the
 *       phase list into pre / falsification / post groups so PlanDetail can
 *       render them in their own sections.
 *
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
