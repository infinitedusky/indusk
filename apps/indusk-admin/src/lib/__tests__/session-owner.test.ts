import { describe, expect, it } from "vitest";
import { ownsSession } from "../session-owner";

/**
 * promise: a-plan-can-start-from-the-admin — admin-plan-authoring A1: one panel per session.
 *
 * A session on a plan's page is shown once: by the planning controls when it
 * is a planning session, by the build controls when it is a build's.
 */
const build = { id: "s", project: "p", plan: "seats", kind: "build" };

describe("one control owns each running session", () => {
  it("a build's session belongs to the build controls, never the planning ones", () => {
    expect(ownsSession(build, "p", "seats", "build")).toBe(true);
    expect(ownsSession(build, "p", "seats", "planning")).toBe(false);
  });

  it("a planning session belongs to the planning controls", () => {
    const planning = { ...build, kind: "planning" };
    expect(ownsSession(planning, "p", "seats", "planning")).toBe(true);
    expect(ownsSession(planning, "p", "seats", "build")).toBe(false);
  });

  it("another plan's or project's session, or none, belongs to neither", () => {
    expect(ownsSession(build, "p", "holds", "build")).toBe(false);
    expect(ownsSession(build, "q", "seats", "build")).toBe(false);
    expect(ownsSession(null, "p", "seats", "build")).toBe(false);
  });
});
