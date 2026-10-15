// promise: a-master-plan-tells-its-story
import { describe, expect, it } from "vitest";
import { masterStory } from "@/lib/master-story";
import { buildGroups } from "@/lib/plan-groups";
import type { Plan } from "@/lib/planning-reader";

const plan = (name: string, over: Partial<Plan> = {}): Plan =>
  ({
    name,
    title: `Title of ${name}`,
    description: `About ${name}.`,
    status: "in-progress",
    archived: false,
    ...over,
  }) as Plan;

const grouping = {
  parents: ["m"],
  roadmap: ["m"],
  subplans: { m: ["one", "two", "three", "inner"], inner: ["deep"] },
  declaredTitles: {
    m: { three: { title: "Third", description: "Not started." } },
  },
};

const build = (released: string[]) => {
  const active = [plan("m"), plan("two"), plan("inner")];
  const archived = [
    plan("one", { archived: true, status: "completed" }),
    plan("deep", { archived: true, status: "completed" }),
  ];
  const isReleased = (n: string) => released.includes(n);
  const { groups } = buildGroups(active, archived, grouping, isReleased);
  const group = groups[0];
  if (!group) throw new Error("no group");
  return masterStory(group, grouping.declaredTitles, isReleased, {
    prefix: "/p/x/plan/",
    waiting: { two: "Review" },
  });
};

describe("masterStory", () => {
  it("lists every declared entry in order with its place", () => {
    const { rows } = build(["one", "deep"]);
    expect(rows.map((r) => [r.number, r.handle])).toEqual([
      [1, "one"],
      [2, "two"],
      [3, "three"],
      [4, "inner"],
    ]);
  });

  it("a released plan says Released, a waiting draft says its step, a queued one opens nothing", () => {
    const { rows } = build(["one", "deep"]);
    expect(rows[0]).toMatchObject({
      state: "released",
      stage: "Released",
      href: "/p/x/plan/one",
    });
    expect(rows[1]).toMatchObject({ state: "draft", stage: "Review" });
    expect(rows[2]).toMatchObject({
      state: "queued",
      stage: "Queued",
      title: "Third",
      description: "Not started.",
      initials: "TH",
    });
    expect(rows[2]?.href).toBeUndefined();
  });

  it("a Path inside is one row linking to its own page, released once all its plans are", () => {
    expect(build(["one"]).rows[3]).toMatchObject({
      state: "draft",
      stage: "0 of 1 released",
      href: "/p/x/plan/inner",
    });
    expect(build(["one", "deep"]).rows[3]).toMatchObject({
      state: "released",
      stage: "1 of 1 released",
    });
  });

  it("counts are the Path group's, so the page and the nav agree", () => {
    // one, two, three and deep are plans: total 4; three is queued.
    expect(build(["one", "deep"]).counts).toEqual({
      released: 2,
      drafts: 1,
      queued: 1,
      total: 4,
    });
  });
});
