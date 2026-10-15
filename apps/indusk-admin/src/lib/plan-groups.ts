import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import { planTitle } from "@infinitedusky/indusk-mcp/promises/display";
import { declaredWithin } from "@/lib/path-nesting";
import type { Plan } from "@/lib/planning-reader";

/** One declared entry of a Path, in the order its master declares it. */
export type PathEntry =
  | { kind: "plan"; plan: Plan; number: number }
  | { kind: "path"; group: PlanGroup; number: number }
  | {
      kind: "placeholder";
      name: string;
      number: number;
      /** Declared, else the handle in words through the project's product words. */
      title: string;
      /** Declared, else empty. */
      description: string;
    };

/** A Path: a parent plan with its declared entries, nested as deep as declared. */
export interface PlanGroup {
  parent: Plan;
  /** 1 for a Path at the top, one more for each Path declared inside it. */
  depth: number;
  entries: PathEntry[];
  /** Plans in this Path and the Paths inside it (placeholders count as not released). */
  total: number;
  released: number;
}

/**
 * Split plans into Paths and everything else.
 *
 * promise: paths-keep-their-order
 *
 * The invariant this function exists to protect: **every plan passed in comes
 * back out**, either inside a Path or in `rest`. Declarations add structure;
 * they never subtract a plan. A declared child with no folder becomes a
 * placeholder rather than silently vanishing, and a parent with no resolvable
 * children is not a Path at all — it stays an ordinary plan.
 *
 * A subplan that is itself a parent opens as a Path inside its parent, to any
 * depth. A master naming its own ancestor stops at the repeat; a plan declared
 * by a Path and by a Path inside it is listed once, under the innermost
 * (`declaredWithin`); a plan declared under two Paths that do not contain one
 * another appears under both. Children resolve against active
 * AND archived plans (active wins a name collision) — an archived subplan is
 * finished work and renders with its real status, never as a "not created
 * yet" placeholder (T11). `rest` is the unclaimed ACTIVE plans; archived plans
 * always keep their own section.
 */
export function buildGroups(
  active: Plan[],
  archived: Plan[],
  grouping: PlanDeclarations | undefined,
  isReleased: (plan: string) => boolean,
  words?: Record<string, string>,
): {
  root: { name: string; title: string } | null;
  groups: PlanGroup[];
  rest: Plan[];
} {
  if (!grouping) return { root: null, groups: [], rest: active };

  const byName = new Map(
    [...archived, ...active].map((p) => [p.name, p] as const),
  );
  const claimed = new Set<string>();
  const opened = new Set<string>();

  const open = (
    parentName: string,
    depth: number,
    ancestors: readonly string[],
  ): PlanGroup | null => {
    const parent = byName.get(parentName);
    const declared = grouping.subplans[parentName] ?? [];
    if (!parent || declared.length === 0 || ancestors.includes(parentName)) {
      return null;
    }
    opened.add(parentName);
    claimed.add(parentName);
    const lineage = [...ancestors, parentName];

    const group: PlanGroup = {
      parent,
      depth,
      entries: [],
      total: 0,
      released: 0,
    };
    let number = 0;
    // A plan a Path inside this one also declares is listed there, innermost.
    const listedInside = declaredWithin(grouping.subplans, parentName);
    for (const childName of declared) {
      // A master naming its own ancestor stops at the repeat.
      if (lineage.includes(childName)) continue;
      if (listedInside.has(childName)) continue;
      const nested = open(childName, depth + 1, lineage);
      number += 1;
      if (nested) {
        group.entries.push({ kind: "path", group: nested, number });
        group.total += nested.total;
        group.released += nested.released;
        continue;
      }
      const child = byName.get(childName);
      if (child) {
        claimed.add(childName);
        group.entries.push({ kind: "plan", plan: child, number });
        group.total += 1;
        if (isReleased(childName)) group.released += 1;
      } else {
        const written = grouping.declaredTitles?.[parentName]?.[childName];
        group.entries.push({
          kind: "placeholder",
          name: childName,
          number,
          title: planTitle(written?.title, childName, words),
          description: written?.description ?? "",
        });
        group.total += 1;
      }
    }
    return group;
  };

  // Top-level Paths: the roadmap's, in its declared order (T13), then any other
  // parent no master declares inside another, in declaration order. A parent
  // declared inside another opens there — unless declarations are a cycle with
  // no entry point, which the last pass opens.
  const parents = Object.keys(grouping.subplans);
  const declaredInside = new Set(
    Object.entries(grouping.subplans).flatMap(([parent, kids]) =>
      kids.filter((k) => k !== parent),
    ),
  );

  const groups: PlanGroup[] = [];
  for (const name of [
    ...grouping.roadmap,
    ...parents.filter((p) => !declaredInside.has(p)),
    ...parents,
  ]) {
    if (opened.has(name)) continue;
    const group = open(name, 1, []);
    if (group) groups.push(group);
  }

  return {
    root: grouping.root ?? null,
    groups,
    rest: active.filter((p) => !claimed.has(p.name)),
  };
}

/** Plans named by the master, in the master's order; any it does not name are left out. */
export function orderByMaster(plans: Plan[], masterOrder: string[]): Plan[] {
  const byName = new Map(plans.map((p) => [p.name, p]));
  const out: Plan[] = [];
  for (const name of masterOrder) {
    const p = byName.get(name);
    if (p) out.push(p);
  }
  return out;
}

/** The Path a plan opens, wherever it sits: at the top or declared inside another. */
export function groupOf(
  groups: PlanGroup[],
  name: string,
): PlanGroup | undefined {
  for (const group of groups) {
    if (group.parent.name === name) return group;
    const inside = groupOf(
      group.entries.flatMap((e) => (e.kind === "path" ? [e.group] : [])),
      name,
    );
    if (inside) return inside;
  }
  return undefined;
}
