// promise: a-master-plan-tells-its-story
// promise: a-plan-page-shows-the-parts-of-its-brief
import { planWaiting } from "@infinitedusky/indusk-mcp/plans/waiting";
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

describe("planLookState — a master plan", () => {
  it("A5 a master plan's page draws plan.master whatever its own documents say", () => {
    for (const briefStatus of [null, "draft", "accepted"])
      for (const waiting of [false, true])
        for (const archived of [false, true])
          for (const position of [undefined, "executing", "monitor"])
            expect(
              planLookState({
                archived,
                position,
                waiting,
                briefStatus,
                master: true,
              }),
            ).toBe("plan.master");
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

/** The plan page's wait is `planWaiting`'s answer alone, amendments included (plan-stories, ADR decision 5). */
const waitsOn = (
  amendments: { plan: string; count: number }[],
  builds: { plan: string; stoppedAt: string | null }[] = [],
) =>
  planWaiting({
    sessions: [],
    plans: [{ name: "p", workflow: "feature", documents: {} }],
    builds,
    amendments,
  }).length > 0;

describe("A16 — an amendment is a wait the plan page counts", () => {
  it("a plan whose only wait is an amendment reports plan.needs-you", () => {
    const waiting = waitsOn([{ plan: "p", count: 1 }]);
    expect(planLookState({ ...base, waiting })).toBe("plan.needs-you");
  });

  it("a plan with no wait and no amendment is still working", () => {
    const waiting = waitsOn([]);
    expect(planLookState({ ...base, waiting })).toBe("plan.working");
  });

  it("a stopped build waits whether or not an amendment does", () => {
    const stopped = [{ plan: "p", stoppedAt: "review" }];
    expect(waitsOn([], stopped)).toBe(true);
    expect(waitsOn([{ plan: "p", count: 1 }], stopped)).toBe(true);
  });
});
