// promise: approval-waits-for-a-finished-plan
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { snapshotOf } from "./plan-snapshot";
import { readActivePlans } from "./planning-reader";

/**
 * approval-waits-for-the-planning-run A10: the plan's page reader, on a real
 * plan folder, hands the snapshot the state of its plan review: missing,
 * unanswered or answered. The reading is the package's; this proves the admin
 * asks it for each plan it reads.
 */

const QUESTIONS = [
  "Do the planned tests prove each promise's sentence, or something narrower?",
  "Does the impl build what each promise claims, and nothing it does not?",
  "Which skip reason would you not accept?",
  "What else would have to change for each promise to hold?",
];

let project: string;
const planDir = () => join(project, ".indusk/planning/p");

const review = (answered: boolean) =>
  [
    "# Plan review",
    "",
    ...QUESTIONS.flatMap((q, i) => [
      `## ${q}`,
      "",
      i === 0
        ? [
            "- a finding",
            "  - breaks when: a run stops early",
            ...(answered ? ["  - answer: fix — the rule reads the file"] : []),
          ].join("\n")
        : "- Nothing.",
      "",
    ]),
  ].join("\n");

async function planReviewOf(): Promise<string | undefined> {
  const plan = (await readActivePlans(project)).find((p) => p.name === "p");
  expect(plan, "the reader did not return the plan").toBeDefined();
  return snapshotOf(plan as NonNullable<typeof plan>).planReview;
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "reader-plan-review-"));
  mkdirSync(planDir(), { recursive: true });
  writeFileSync(join(project, ".indusk/config.json"), '{ "mode": "full" }\n');
  const doc = (status: string) =>
    `---\ntitle: "P"\nstatus: ${status}\nworkflow: bugfix\n---\n\n# P\n`;
  writeFileSync(join(planDir(), "brief.md"), doc("accepted"));
  writeFileSync(join(planDir(), "test-plan.md"), doc("accepted"));
  writeFileSync(join(planDir(), "impl.md"), doc("draft"));
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

describe("A10 — a plan read from its folder carries its plan review's state", () => {
  it("A10 no plan-review.md reads missing", async () => {
    expect(await planReviewOf()).toBe("missing");
  });

  it("A10 a finding without its answer reads unanswered", async () => {
    writeFileSync(join(planDir(), "plan-review.md"), review(false));
    expect(await planReviewOf()).toBe("unanswered");
  });

  it("A10 every question's section and every finding answered reads answered", async () => {
    writeFileSync(join(planDir(), "plan-review.md"), review(true));
    expect(await planReviewOf()).toBe("answered");
  });
});
