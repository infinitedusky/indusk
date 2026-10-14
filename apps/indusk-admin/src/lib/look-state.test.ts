import { describe, expect, it } from "vitest";
import { briefLookState, navLookState, planLookState } from "@/lib/look-state";

const base = {
  archived: false,
  waiting: false,
  briefStatus: "accepted" as string | null,
};

describe("planLookState — what the plan page says it draws", () => {
  it("is released once archived or in monitor, whatever else is true", () => {
    expect(planLookState({ ...base, archived: true, waiting: true })).toBe(
      "plan.released",
    );
    expect(planLookState({ ...base, position: "monitor" })).toBe(
      "plan.released",
    );
  });

  it("needs you while it waits on a person", () => {
    expect(planLookState({ ...base, waiting: true })).toBe("plan.needs-you");
  });

  it("opens on its parts while the brief is not finished", () => {
    expect(planLookState({ ...base, briefStatus: "draft" })).toBe("plan.parts");
    expect(planLookState({ ...base, briefStatus: null })).toBe("plan.parts");
  });

  it("is working when the brief is finished and nothing waits", () => {
    expect(planLookState(base)).toBe("plan.working");
  });
});

describe("briefLookState — what the brief page says it draws", () => {
  it("is approved once the impl carries the brief's approval, else writing", () => {
    expect(briefLookState({ approved_brief: "abc" }, true)).toBe(
      "brief.approved",
    );
    expect(briefLookState({}, true)).toBe("brief.writing");
    expect(briefLookState(undefined, true)).toBe("brief.writing");
  });

  it("is empty while the plan has no brief file, whatever its impl says", () => {
    expect(briefLookState(undefined, false)).toBe("brief.empty");
    expect(briefLookState({ approved_brief: "abc" }, false)).toBe(
      "brief.empty",
    );
  });
});

describe("navLookState — what the nav says it draws", () => {
  it("is collapsed when folded, wider only past the opening width, else expanded", () => {
    expect(navLookState({ folded: true, width: 440, opening: 280 })).toBe(
      "nav.collapsed",
    );
    expect(navLookState({ folded: false, width: 440, opening: 280 })).toBe(
      "nav.wide",
    );
    expect(navLookState({ folded: false, width: 280, opening: 280 })).toBe(
      "nav.expanded",
    );
    expect(navLookState({ folded: false, width: null, opening: null })).toBe(
      "nav.expanded",
    );
  });
});
