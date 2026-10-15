import type { PlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { describe, expect, it } from "vitest";
import { extractPhases } from "@/lib/phases";
import {
  expectationsSummary,
  looksSummary,
  phasesSummary,
  phaseView,
  planDocuments,
  promisesSummary,
} from "@/lib/plan-parts-view";
import type { Plan } from "@/lib/planning-reader";

const parts = (over: Partial<PlanParts>): PlanParts => ({
  plan: "p",
  hasBrief: true,
  hasBriefFile: true,
  promises: [],
  expectations: [],
  looks: [],
  noLooks: null,
  amendments: [],
  amendmentsUnreadable: null,
  description: null,
  briefStatus: null,
  ...over,
});

const phases = extractPhases(
  [
    "### Test Phase 1: A",
    "- [x] a",
    "- [x] b",
    "### Build Phase 1: B",
    "- [x] c",
    "- [ ] d",
    "### Build Phase 2: C",
    "- [ ] e",
  ].join("\n"),
);

describe("the closed rows' summaries", () => {
  it("counts promises and those enforced", () => {
    const p = parts({
      promises: [
        { name: "a", sentence: "", state: "enforced" },
        { name: "b", sentence: "", state: "declared" },
      ],
    });
    expect(promisesSummary(p)).toBe("2 · 1 enforced");
  });

  it("counts expectations, and says none when there are none", () => {
    expect(expectationsSummary(parts({}))).toBe("none");
    expect(
      expectationsSummary(
        parts({ expectations: [{ text: "x", measure: null, look: null }] }),
      ),
    ).toBe("1");
  });

  it("counts looks approved of listed, or gives the reason none are listed", () => {
    const look = (approval: "approved" | "proposed") => ({
      name: approval,
      relation: "makes" as const,
      approval,
      plan: null,
      app: null,
      document: null,
      devices: [],
    });
    expect(
      looksSummary(parts({ looks: [look("approved"), look("proposed")] })),
    ).toBe("1 of 2 approved");
    expect(looksSummary(parts({ noLooks: "None — no interface" }))).toBe(
      "None — no interface",
    );
  });

  it("names the current phase and the items done of all", () => {
    expect(phasesSummary(phases, null)).toBe("Phase 1 of 2 · 3 of 5 done");
    expect(phasesSummary(phases, "build-2")).toBe("Phase 2 of 2 · 3 of 5 done");
  });

  it("says all phases done when every item is checked", () => {
    const done = extractPhases("### Build Phase 1: A\n- [x] a\n");
    expect(phasesSummary(done, null)).toBe("All phases done · 1 of 1 done");
  });
});

describe("a phase as a row", () => {
  it("reads done, in progress and not started from its items", () => {
    expect(phaseView(phases[0], null)).toMatchObject({
      count: "2 of 2",
      state: "done ✓",
      tone: "done",
    });
    expect(phaseView(phases[1], null)).toMatchObject({
      count: "1 of 2",
      state: "in progress",
      tone: "doing",
    });
    expect(phaseView(phases[2], null)).toMatchObject({
      state: "not started",
      tone: "idle",
    });
  });
});

describe("planDocuments — a master's own document", () => {
  const plan = { name: "m", brief: undefined } as unknown as Plan;

  it("lists master first, as Master plan, only when its body was read", () => {
    expect(planDocuments(plan).map((d) => d.slug)).toEqual([]);
    const [first] = planDocuments(plan, "# The order");
    expect(first).toMatchObject({
      slug: "master",
      label: "Master plan",
      content: "# The order",
    });
  });
});
