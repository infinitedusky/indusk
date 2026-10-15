// promise: paths-keep-their-order
// promise: a-plan-reads-by-its-title
import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import { describe, expect, it } from "vitest";
import { buildGroups, type PathEntry, type PlanGroup } from "@/lib/plan-groups";
import type { Plan } from "@/lib/planning-reader";

/**
 * A17 — `buildGroups` returns every plan passed in, inside a Path or in
 * `rest`, for nested Paths, a declared cycle and a child declared under two
 * parents. The function was moved out of `PlanList.tsx` unchanged; the
 * PlanList tests passing unchanged are the parity evidence.
 */

const plan = (name: string, archived = false): Plan => ({
  name,
  title: name,
  description: null,
  status: "in-progress",
  archived,
});

const declare = (
  subplans: Record<string, string[]>,
  roadmap: string[] = [],
): PlanDeclarations => ({
  parents: Object.keys(subplans),
  roadmap,
  subplans,
  declaredTitles: {},
});

const never = () => false;

/** Every plan name inside a Path, at any depth (the parent, then its entries). */
function namesIn(group: PlanGroup): string[] {
  const fromEntry = (e: PathEntry): string[] =>
    e.kind === "plan"
      ? [e.plan.name]
      : e.kind === "path"
        ? namesIn(e.group)
        : [];
  return [group.parent.name, ...group.entries.flatMap(fromEntry)];
}

function everyName(result: ReturnType<typeof buildGroups>): Set<string> {
  return new Set([
    ...result.groups.flatMap(namesIn),
    ...result.rest.map((p) => p.name),
  ]);
}

describe("buildGroups — A17 every plan passed in comes back out", () => {
  it("without declarations every active plan is in rest", () => {
    const active = [plan("a"), plan("b")];
    const out = buildGroups(active, [], undefined, never);
    expect(out.groups).toEqual([]);
    expect(out.rest).toEqual(active);
  });

  it("nested Paths keep every plan, and the inner Path opens inside its parent", () => {
    const active = ["outer", "inner", "leaf", "sibling", "loose"].map((n) =>
      plan(n),
    );
    const out = buildGroups(
      active,
      [],
      declare({ outer: ["inner", "sibling"], inner: ["leaf"] }),
      never,
    );
    expect(everyName(out)).toEqual(new Set(active.map((p) => p.name)));
    expect(out.groups.map((g) => g.parent.name)).toEqual(["outer"]);
    expect(out.groups[0].entries.map((e) => e.kind)).toEqual(["path", "plan"]);
    expect(out.rest.map((p) => p.name)).toEqual(["loose"]);
  });

  it("a declared cycle loses no plan and stops at the repeat", () => {
    const active = [plan("a"), plan("b")];
    const out = buildGroups(active, [], declare({ a: ["b"], b: ["a"] }), never);
    expect(everyName(out)).toEqual(new Set(["a", "b"]));
  });

  it("a child declared under two parents appears under both and is not in rest", () => {
    const active = [plan("p1"), plan("p2"), plan("shared")];
    const out = buildGroups(
      active,
      [],
      declare({ p1: ["shared"], p2: ["shared"] }),
      never,
    );
    expect(
      out.groups.flatMap(namesIn).filter((n) => n === "shared"),
    ).toHaveLength(2);
    expect(out.rest).toEqual([]);
  });

  it("an archived child resolves with its own plan, a missing one becomes a placeholder", () => {
    const out = buildGroups(
      [plan("parent")],
      [plan("done", true)],
      declare({ parent: ["done", "ghost"] }),
      never,
    );
    expect(out.groups[0].entries.map((e) => e.kind)).toEqual([
      "plan",
      "placeholder",
    ]);
    expect(out.rest).toEqual([]);
  });

  it("counts released plans from the predicate", () => {
    const out = buildGroups(
      [plan("parent"), plan("x"), plan("y")],
      [],
      declare({ parent: ["x", "y"] }),
      (n) => n === "x",
    );
    expect(out.groups[0]).toMatchObject({ total: 2, released: 1 });
  });
});

/** The title and description a queued plan's entry carries (A24), read without a type that names them. */
const queuedOf = (e: PathEntry) => ({
  title: "title" in e ? e.title : undefined,
  description: "description" in e ? e.description : undefined,
});

describe("buildGroups — A24 a queued plan reads by its title", () => {
  const queued = (
    declaredTitles: PlanDeclarations["declaredTitles"],
    words?: Record<string, string>,
  ) => {
    const out = buildGroups(
      [plan("parent")],
      [],
      {
        ...declare({ parent: ["ghost-plan", "vscode-hooks"] }),
        declaredTitles,
      },
      never,
      words,
    );
    return out.groups[0].entries.map(queuedOf);
  };

  it("its declared title and description ride on the entry", () => {
    const [ghost] = queued({
      parent: { "ghost-plan": { title: "The ghost", description: "Not yet." } },
    });
    expect(ghost).toEqual({ title: "The ghost", description: "Not yet." });
  });

  it("with none declared it reads as its handle in words, through the project's product words", () => {
    const [ghost, hooks] = queued({}, { ghost: "Spectre" });
    expect(ghost).toEqual({ title: "Spectre plan", description: "" });
    expect(hooks.title).toBe("VS Code hooks");
  });
});
