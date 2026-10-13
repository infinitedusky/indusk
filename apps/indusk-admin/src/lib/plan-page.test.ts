// A32 of brief-as-the-contract: the three plan routes find their plan one way.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPlanPage } from "./plan-page";

const registry = vi.hoisted(() => ({
  path: null as string | null,
  exists: true,
}));
const plans = vi.hoisted(() => ({
  active: [] as { name: string; from: string }[],
  archived: [] as { name: string; from: string }[],
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/registry-client", () => ({
  getProjectPath: () => registry.path,
  projectPathExists: () => registry.exists,
}));
vi.mock("@/lib/planning-reader", () => ({
  readActivePlans: async () => plans.active,
  readArchivedPlans: async () => plans.archived,
}));

beforeEach(() => {
  registry.path = "/work/demo";
  registry.exists = true;
  plans.active = [];
  plans.archived = [];
});

describe("readPlanPage", () => {
  it("A32 gives the routes their plan: active over archived, null for a gone project, not-found for no plan", async () => {
    plans.active = [{ name: "x", from: "active" }];
    plans.archived = [
      { name: "x", from: "archived" },
      { name: "old", from: "archived" },
    ];
    expect(await readPlanPage("demo", "x")).toEqual({
      projectPath: "/work/demo",
      plan: { name: "x", from: "active" },
    });
    expect(await readPlanPage("demo", "old")).toEqual({
      projectPath: "/work/demo",
      plan: { name: "old", from: "archived" },
    });
    await expect(readPlanPage("demo", "nope")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    registry.exists = false;
    expect(await readPlanPage("demo", "x")).toBeNull();
    registry.exists = true;
    registry.path = null;
    expect(await readPlanPage("demo", "x")).toBeNull();
  });
});
