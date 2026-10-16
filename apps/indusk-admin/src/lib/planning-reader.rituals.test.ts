// promise: a-finished-ritual-stays-done
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markTerminated } from "@infinitedusky/indusk-mcp/falsification/log";
import { planSteps } from "@infinitedusky/indusk-mcp/plans/steps";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { snapshotOf } from "./plan-snapshot";
import { readActivePlans } from "./planning-reader";

/**
 * a-finished-ritual-stays-done A2: the package half (steps.test.ts A1) is fed
 * facts; this half reads them from a plan folder on disk through the reader the
 * plan's page uses. Falsification (Build Phase 4) and cleanup (Build Phase 5)
 * are closed, the audit is written, and an audit follow-up (Build Phase 6)
 * reopened the build — the shape seen on `plans-are-promises`.
 */

let project: string;
const planDir = () => join(project, ".indusk/planning/p");

interface ImplShape {
  /** Extra frontmatter lines (a skip and its reason). */
  frontmatter?: string[];
  /** Leave the Falsification phase out (a legacy log stands in). */
  noFalsificationPhase?: boolean;
  /** The Cleanup phase's item stays unchecked. */
  openCleanup?: boolean;
}

function writeImpl(shape: ImplShape): void {
  writeFileSync(
    join(planDir(), "impl.md"),
    [
      "---",
      'title: "P"',
      "status: in-progress",
      ...(shape.frontmatter ?? []),
      "---",
      "",
      "# P",
      "",
      "## Checklist",
      "",
      "### Build Phase 1: The work",
      "- [x] built",
      "",
      ...(shape.noFalsificationPhase
        ? []
        : ["### Build Phase 4: Falsification — hunt", "- [x] hunted", ""]),
      "### Build Phase 5: Cleanup — extract",
      `- [${shape.openCleanup ? " " : "x"}] extracted`,
      "",
      "### Build Phase 6: Audit follow-ups",
      "- [ ] fix what the audit found",
      "",
    ].join("\n"),
  );
}

async function statesOf(): Promise<Record<string, string>> {
  const plan = (await readActivePlans(project)).find((p) => p.name === "p");
  expect(plan, "the reader did not return the plan").toBeDefined();
  const { release } = planSteps(snapshotOf(plan as NonNullable<typeof plan>));
  return Object.fromEntries(release.map((s) => [s.name, s.state]));
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "reader-rituals-"));
  const plan = join(project, ".indusk/planning/p");
  mkdirSync(plan, { recursive: true });
  writeFileSync(join(project, ".indusk/config.json"), '{ "mode": "full" }\n');
  const doc = (status: string) =>
    `---\ntitle: "P"\nstatus: ${status}\nworkflow: bugfix\n---\n\n# P\n`;
  writeFileSync(join(plan, "brief.md"), doc("accepted"));
  writeFileSync(join(plan, "test-plan.md"), doc("accepted"));
  writeImpl({});
  writeFileSync(join(plan, "audit.md"), "# Audit\n\nRead by a fresh reader.\n");
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

describe("A2 — a plan read from its folder keeps its finished rituals done", () => {
  it("Falsify, Cleanup and Audit done, Build current, while a build phase is open", async () => {
    const plan = (await readActivePlans(project)).find((p) => p.name === "p");
    expect(plan, "the reader did not return the plan").toBeDefined();
    const { release } = planSteps(snapshotOf(plan as NonNullable<typeof plan>));
    const states = Object.fromEntries(release.map((s) => [s.name, s.state]));
    expect(states).toMatchObject({
      Build: "current",
      Falsify: "done",
      Cleanup: "done",
      Audit: "done",
    });
  });
});

describe("Build Phase 2 — the reopened plan's other cases", () => {
  it("A6 — a completed legacy falsification log reads Falsify done", async () => {
    writeImpl({ noFalsificationPhase: true });
    markTerminated(planDir(), "investigated; nothing in scope remained");
    expect(await statesOf()).toMatchObject({
      Falsify: "done",
      Build: "current",
    });
  });

  it("A7 — a Cleanup phase with an unchecked item does not read done", async () => {
    writeImpl({ openCleanup: true });
    const states = await statesOf();
    expect(states.Cleanup).not.toBe("done");
    expect(states.Falsify).toBe("done");
  });

  it("A8 — a skip with a reason beats a closed phase", async () => {
    writeImpl({
      frontmatter: [
        "cleanup: skipped",
        'cleanup_reason: "nothing to decompose"',
      ],
    });
    const plan = (await readActivePlans(project)).find((p) => p.name === "p");
    const { release } = planSteps(snapshotOf(plan as NonNullable<typeof plan>));
    const cleanup = release.find((s) => s.name === "Cleanup");
    expect(cleanup?.state).toBe("skipped");
    expect(JSON.stringify(cleanup)).toContain("nothing to decompose");
  });
});
