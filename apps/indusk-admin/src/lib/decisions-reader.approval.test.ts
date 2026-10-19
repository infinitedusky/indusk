// promise: approval-waits-for-a-finished-plan
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planReviewHash } from "../../../indusk-mcp/src/lib/audit/review-hash";

/**
 * a-run-can-be-trusted A50–A55: a plan is offered for approval only when its impl is
 * written, no session is still writing it, and its plan review was written for the
 * documents as they stand with every finding answered. The offer is read where the
 * admin decides it: the admin's planning reader builds each plan's snapshot and the
 * package's waiting list turns it into entries (`readWaiting`). A54 asks the approve
 * command's readiness check (`readPlanningState`'s review, which `plans approve` and the
 * planning run's stop use) the same question and expects the same answer.
 *
 * Real plan folders in a temporary project; only what the host stands on is stood in for
 * (the session host and the registry), as the sibling planning tests do.
 */

const QUESTIONS = [
  "Do the planned tests prove each promise's sentence, or something narrower?",
  "Does the impl build what each promise claims, and nothing it does not?",
  "Which skip reason would you not accept?",
  "What else would have to change for each promise to hold?",
];

const writing = vi.hoisted(() => ({ on: false }));

vi.mock("./session-host", () => ({
  planLocation: async () => ({ root: "/p", cwd: "/p" }),
  sessionManager: () => ({
    forPlan: () => undefined,
    admitBuild: () => () => {},
    running: () =>
      writing.on ? [{ id: "s1", project: "proj", plan: "p", kind: "planning" }] : [],
    pendingQuestion: () => null,
    isWriting: () => writing.on,
  }),
}));
vi.mock("./registry-client", () => ({ getProjectPath: () => project }));

import { readPlanningState } from "@infinitedusky/indusk-mcp/build";
import { readWaiting } from "./decisions-reader";
import { readActivePlans } from "./planning-reader";

const PROJECT = "proj";
const PLAN = "p";
let project: string;
const planDir = () => join(project, ".indusk/planning", PLAN);
const read = (file: string) => readFileSync(join(planDir(), file), "utf-8");

const doc = (status: string, body = "") =>
  `---\ntitle: "P"\nstatus: ${status}\nworkflow: bugfix\n---\n\n# P\n${body}`;

/** A plan review in the shape the reader reads; `read` is the hash it records. */
const reviewText = (opts: { read: string | null; answered: boolean }) =>
  [
    ...(opts.read === null ? [] : ["---", `read: ${opts.read}`, "---", ""]),
    "# Plan review",
    "",
    ...QUESTIONS.flatMap((q, i) => [
      `## ${q}`,
      "",
      i === 0
        ? [
            "- a finding",
            "  - breaks when: a run stops early",
            ...(opts.answered ? ["  - answer: fix — the rule reads the file"] : []),
          ].join("\n")
        : "- Nothing.",
      "",
    ]),
  ].join("\n");

/** The hash of the four documents as they stand now. */
const documentsHash = () =>
  planReviewHash({
    brief: read("brief.md"),
    testPlan: read("test-plan.md"),
    adr: null,
    impl: read("impl.md"),
  });

beforeEach(() => {
  writing.on = false;
  project = mkdtempSync(join(tmpdir(), "approval-offer-"));
  mkdirSync(planDir(), { recursive: true });
  writeFileSync(join(project, ".indusk/config.json"), '{ "mode": "full" }\n');
  writeFileSync(join(planDir(), "brief.md"), doc("accepted"));
  writeFileSync(join(planDir(), "test-plan.md"), doc("accepted"));
  writeFileSync(join(planDir(), "impl.md"), doc("draft"));
  const g = globalThis as unknown as Record<symbol, Map<string, unknown>>;
  g[Symbol.for("indusk.admin.plannings")]?.clear();
  g[Symbol.for("indusk.admin.builds")]?.clear();
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

/** What the plan waits on in the admin's waiting list: the entry kinds for the plan. */
async function waitingOn(): Promise<string[]> {
  const plans = await readActivePlans(project);
  return (await readWaiting(PROJECT, project, plans))
    .filter((w) => w.plan === PLAN)
    .map((w) => w.on);
}

/** Whether `plans approve`'s readiness check (the planning state's review) lets the plan through. */
async function approveReady(): Promise<boolean> {
  const { review } = await readPlanningState(project, PLAN);
  return review.exists && review.complete && review.stale !== true;
}

const writeReview = (opts: { read: "now" | "older" | null; answered: boolean }) =>
  writeFileSync(
    join(planDir(), "plan-review.md"),
    reviewText({
      read: opts.read === null ? null : opts.read === "now" ? documentsHash() : "0".repeat(64),
      answered: opts.answered,
    }),
  );

describe("the offer of approval", () => {
  it("A51: a plan whose review is current and has every finding answered is offered for approval", async () => {
    writeReview({ read: "now", answered: true });
    expect(await waitingOn()).toEqual(["approval"]);
  });

  it("A50: a plan whose review was written for documents that have since changed is not offered; it needs its plan review", async () => {
    writeReview({ read: "older", answered: true });
    expect(await waitingOn()).toEqual(["plan-review"]);
  });

  it("A52: a written impl with no plan review at all and no run is listed as needing its plan review", async () => {
    expect(await waitingOn()).toEqual(["plan-review"]);
  });

  it("A53: a plan whose review has an unanswered finding is not offered", async () => {
    writeReview({ read: "now", answered: false });
    expect(await waitingOn()).toEqual(["plan-review"]);
  });

  it("A55: a plan a session is still writing is neither offered nor listed as needing a plan review", async () => {
    writing.on = true;
    writeReview({ read: "now", answered: true });
    expect(await waitingOn()).toEqual([]);
  });
});

describe("approving agrees with the offer", () => {
  const states = [
    { name: "current and answered", read: "now", answered: true },
    { name: "written for older documents", read: "older", answered: true },
    { name: "no read hash recorded", read: null, answered: true },
    { name: "an unanswered finding", read: "now", answered: false },
    { name: "no plan review", read: "absent", answered: false },
  ] as const;

  for (const s of states) {
    it(`A54: ${s.name}: the offer and plans approve's check give one answer`, async () => {
      if (s.read !== "absent") writeReview({ read: s.read, answered: s.answered });
      const offered = (await waitingOn()).includes("approval");
      expect(await approveReady()).toBe(offered);
    });
  }
});
