import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseImplString } from "@infinitedusky/indusk-mcp/impl-parser";
import type { PhaseBoundaryRecord } from "@infinitedusky/indusk-mcp/shape/boundary";
import { afterEach, describe, expect, it } from "vitest";
import { deriveActivePhase } from "./active-phase";
import { readActivePlans } from "./planning-reader";

/**
 * admin-ui-phase-progress — A6 and A7 (the reader half).
 *
 * The active-phase rule is stated in the assertion so the design cannot leave
 * it implicit: the most recent boundary record among OPEN phases wins; a
 * phase with every item checked is closed whatever its record says; with no
 * records at all the first open phase in document order is active and the
 * result says it guessed. A malformed record file is surfaced as an error
 * on the plan, never as an empty record set.
 */

const IMPL = [
  "## Checklist",
  "",
  "### Build Phase 1: Done",
  "",
  "- [x] a",
  "",
  "#### Build Phase 1 Verification",
  "",
  "- [x] green",
  "",
  "### Build Phase 2: Open",
  "",
  "- [ ] b",
  "",
  "#### Build Phase 2 Verification",
  "",
  "- [ ] red",
  "",
  "### Build Phase 3: Also open",
  "",
  "- [ ] c",
  "",
  "#### Build Phase 3 Verification",
  "",
  "- [ ] red",
  "",
].join("\n");

function rec(phase: number, time: string): PhaseBoundaryRecord {
  return {
    plan: "p",
    phase,
    kind: "build",
    sha: "abc",
    timestamp: `2026-09-16T${time}:00.000Z`,
  };
}

describe("A6 — which phase is active", () => {
  const phases = parseImplString(IMPL).phases;

  it("the most recent boundary record among open phases wins", () => {
    const active = deriveActivePhase(phases, [
      rec(1, "09:00"),
      rec(2, "10:00"),
      rec(3, "09:30"),
    ]);
    expect(active.ref).toEqual({ kind: "build", number: 2 });
    expect(active.hint).toBeUndefined();
    expect(active.openedAt).toBe("2026-09-16T10:00:00.000Z");
  });

  it("a closed phase's record is ignored even when it is the newest", () => {
    const active = deriveActivePhase(phases, [rec(1, "11:00")]);
    expect(active.ref).toEqual({ kind: "build", number: 2 });
    expect(active.hint).toBe("no boundary record");
  });

  it("with no records the first open phase in document order is active, and says it guessed", () => {
    expect(deriveActivePhase(phases, [])).toMatchObject({
      ref: { kind: "build", number: 2 },
      hint: "no boundary record",
    });
  });

  it("a plan with every item checked has no active phase", () => {
    const closed = parseImplString(
      "## Checklist\n\n### Build Phase 1: Done\n\n- [x] a\n\n#### Build Phase 1 Verification\n\n- [x] ok\n",
    ).phases;
    expect(deriveActivePhase(closed, [rec(1, "09:00")])).toEqual({ ref: null });
  });

  it("a record without kind is a build record; a test-phase record does not claim the build phase", () => {
    const legacy: PhaseBoundaryRecord = {
      plan: "p",
      phase: 2,
      sha: "abc",
      timestamp: "2026-09-16T12:00:00.000Z",
    };
    const test: PhaseBoundaryRecord = {
      ...legacy,
      kind: "test",
      timestamp: "2026-09-16T13:00:00.000Z",
    };
    expect(deriveActivePhase(phases, [legacy]).openedAt).toBe(legacy.timestamp);
    expect(deriveActivePhase(phases, [test]).hint).toBe("no boundary record");
  });
});

describe("A7 — a malformed boundary record file is an error on the plan", () => {
  let root: string | null = null;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  it("readActivePlans sets boundaryError and no boundaries when a line is not JSON", async () => {
    root = mkdtempSync(join(tmpdir(), "boundary-error-"));
    mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
    writeFileSync(
      join(root, ".indusk", "planning", "p", "impl.md"),
      `---\ntitle: "P"\nstatus: in-progress\n---\n\n${IMPL}`,
    );
    writeFileSync(
      join(root, ".indusk", "phase-boundary.jsonl"),
      '{"plan":"p","phase":1,"sha":"abc","timestamp":"2026-09-16T00:00:00.000Z"}\nthis is not json\n',
    );
    const [plan] = await readActivePlans(root);
    expect(plan.boundaryError).toBeDefined();
    expect(plan.boundaries).toBeUndefined();
  });

  it("a clean record file yields the plan's own records", async () => {
    root = mkdtempSync(join(tmpdir(), "boundary-clean-"));
    mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
    writeFileSync(
      join(root, ".indusk", "planning", "p", "impl.md"),
      `---\ntitle: "P"\nstatus: in-progress\n---\n\n${IMPL}`,
    );
    writeFileSync(
      join(root, ".indusk", "phase-boundary.jsonl"),
      '{"plan":"p","phase":2,"kind":"build","sha":"abc","timestamp":"2026-09-16T00:00:00.000Z"}\n{"plan":"other","phase":1,"sha":"abc","timestamp":"2026-09-16T00:00:00.000Z"}\n',
    );
    const [plan] = await readActivePlans(root);
    expect(plan.boundaryError).toBeUndefined();
    expect(plan.boundaries?.map((r) => r.plan)).toEqual(["p"]);
    expect(plan.position?.position).toBe("executing");
  });
});
