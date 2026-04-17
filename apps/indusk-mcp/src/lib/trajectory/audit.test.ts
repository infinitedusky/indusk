import { describe, expect, it } from "vitest";
import {
	auditDeferredMitigations,
	auditPlanAtClose,
	findBlockedRows,
	resolveTestIdCommand,
} from "./audit.js";
import { parseTrajectory } from "./parser.js";

const withDeferred = (deferredBlock: string) => `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | anchor test | Phase 1 | Phase 1 | passing |

${deferredBlock}

## Checklist
`;

describe("T21: retrospective audits Deferred Verification for mitigation completeness", () => {
	it("flags a vague mitigation (too short + unclassified)", () => {
		const body = withDeferred(`### Deferred Verification

- **Thing**
  - reason: reason
  - would require: unlock
  - mitigation: we will check`);
		const trajectory = parseTrajectory(body);
		const findings = auditDeferredMitigations(trajectory);
		expect(findings.length).toBe(1);
		expect(findings[0].warning).not.toBeNull();
		expect(findings[0].warning).toContain("vague");
	});

	it("classifies a telemetry-alert mitigation", () => {
		const body = withDeferred(`### Deferred Verification

- **LLM quality**
  - reason: cannot deterministically assert quality
  - would require: dedicated eval harness
  - mitigation: OTel metric sync.skew_ms with Dash0 alert when p99 exceeds threshold`);
		const findings = auditDeferredMitigations(parseTrajectory(body));
		expect(findings[0].kind).toBe("telemetry-alert");
		expect(findings[0].warning).toBeNull();
	});

	it("classifies a scheduled-review mitigation", () => {
		const body = withDeferred(`### Deferred Verification

- **Spec drift**
  - reason: requires human judgment
  - would require: rubric-based eval
  - mitigation: weekly spot-check of 5 percent sample with named owner reviewing`);
		const findings = auditDeferredMitigations(parseTrajectory(body));
		expect(findings[0].kind).toBe("scheduled-review");
	});

	it("classifies a downstream-plan mitigation and extracts plan-ref hints", () => {
		const body = withDeferred(`### Deferred Verification

- **Real API**
  - reason: paid
  - would require: CI budget
  - mitigation: tracked in graph-knowledge-architecture and resolved there`);
		const findings = auditDeferredMitigations(parseTrajectory(body));
		expect(findings[0].kind).toBe("downstream-plan");
		expect(findings[0].hints).toContain("graph-knowledge-architecture");
	});

	it("classifies a feedback-signal mitigation", () => {
		const body = withDeferred(`### Deferred Verification

- **UX**
  - reason: subjective
  - would require: usability study
  - mitigation: user feedback channel routed to #quality with ticket triage`);
		const findings = auditDeferredMitigations(parseTrajectory(body));
		expect(findings[0].kind).toBe("feedback-signal");
	});

	it("returns empty findings when there are no deferred rows", () => {
		const body = withDeferred("");
		const findings = auditDeferredMitigations(parseTrajectory(body));
		expect(findings).toEqual([]);
	});
});

describe("findBlockedRows surfaces trajectory rows ending in blocked state", () => {
	it("returns rows with state blocked", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | passing |
| T2 | b | Phase 2 | Phase 2 | blocked |
| T3 | c | Phase 2 | Phase 2 | skipped |

## Checklist
`;
		const findings = findBlockedRows(parseTrajectory(body));
		expect(findings.length).toBe(1);
		expect(findings[0].row.id).toBe("T2");
		expect(findings[0].message).toContain("blocked");
	});

	it("returns empty when no rows are blocked", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | passing |

## Checklist
`;
		expect(findBlockedRows(parseTrajectory(body))).toEqual([]);
	});
});

describe("T22: verify skill resolves test ID to test file and command", () => {
	it("extracts a keyword from backtick code in asserts", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | \`fold(deposit+withdraw)\` returns expected derived map | Phase 1 | Phase 1 | planned |

## Checklist
`;
		const res = resolveTestIdCommand(parseTrajectory(body), "T1");
		expect(res).not.toBeNull();
		expect(res?.id).toBe("T1");
		expect(res?.suggestedCommand).toContain("fold");
		expect(res?.fileGlob).toContain("fold");
	});

	it("falls back to the longest identifier when no backticks present", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | reconciler module computes derived map from events | Phase 1 | Phase 1 | planned |

## Checklist
`;
		const res = resolveTestIdCommand(parseTrajectory(body), "T1");
		expect(res?.suggestedCommand).toContain("reconciler");
	});

	it("returns null for unknown ID", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | planned |

## Checklist
`;
		expect(resolveTestIdCommand(parseTrajectory(body), "T99")).toBeNull();
	});
});

describe("auditPlanAtClose returns combined findings", () => {
	it("includes both deferred classifications and blocked findings", () => {
		const body = `## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a | Phase 1 | Phase 1 | blocked |

### Deferred Verification

- **Thing**
  - reason: r
  - would require: w
  - mitigation: x

## Checklist
`;
		const result = auditPlanAtClose(body);
		expect(result.blocked.length).toBe(1);
		expect(result.deferred.length).toBe(1);
		expect(result.deferred[0].warning).not.toBeNull();
	});
});
