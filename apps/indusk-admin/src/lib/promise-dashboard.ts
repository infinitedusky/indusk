import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import type {
  Standing,
  StandingRow,
} from "@infinitedusky/indusk-mcp/promises/standing";
import { innermostPath } from "./path-nesting";

/**
 * The promises dashboard, worked out (plan-cockpit, ADR decision 5): one row
 * per promise from the package's standing, then filtered, grouped and sorted
 * by what the URL asks. Pure — rows and a query in, groups out — so the page
 * renders it and a test reads it without a browser. What a promise stands at
 * is `promises/standing`'s answer, never decided here.
 *
 * promise: every-promise-is-listed
 * promise: broken-promises-come-first
 */

export type Grouping = "state" | "plan" | "path";
export type Sorting = "activity" | "name" | "plan";

export const GROUPINGS: ReadonlyArray<{ key: Grouping; label: string }> = [
  { key: "state", label: "State" },
  { key: "plan", label: "Plan" },
  { key: "path", label: "Path" },
];
export const SORTINGS: ReadonlyArray<{ key: Sorting; label: string }> = [
  { key: "activity", label: "Latest activity" },
  { key: "name", label: "Name" },
  { key: "plan", label: "Plan" },
];

export interface DashboardQuery {
  group: Grouping;
  sort: Sorting;
  q: string;
}

/** The query as the URL carried it; anything unrecognised falls back to the default. */
export function parseQuery(raw: {
  group?: string;
  sort?: string;
  q?: string;
}): DashboardQuery {
  return {
    group: GROUPINGS.find((g) => g.key === raw.group)?.key ?? "state",
    sort: SORTINGS.find((s) => s.key === raw.sort)?.key ?? "activity",
    q: (raw.q ?? "").trim(),
  };
}

export interface DashboardRow {
  name: string;
  /** The promise's sentence in words. */
  sentence: string;
  plan: string;
  planTitle: string;
  /** The innermost Path declaring the plan; null when none does. */
  path: string | null;
  /** That Path's master by title; null when no Path declares the plan. */
  pathTitle: string | null;
  standing: Standing;
  tests: { passing: number; total: number };
  /** Days of the last thirty not broken; null while the promise has never been seen. */
  held: number | null;
  /** Days of the last thirty with a break heard. */
  broke: number;
  lastActivity: string | null;
  /** The newest break: a heard break, or the alarm source's last sighting while broken. */
  lastBreak: string | null;
}

export interface RowContext {
  planTitles: Record<string, string>;
  /** A promise's name in words: the package's `promiseWords`, handed in so this module stays free of the file readers and loads in the client. */
  sentenceOf: (name: string) => string;
  declarations: Pick<PlanDeclarations, "subplans">;
}

/**
 * A plan by its title: the one written when it is not just the handle, else
 * the handle in words (`sentenceOf`, the package's `promiseWords`) — never the
 * bare folder name (plan-stories A26).
 */
function titled(ctx: RowContext, handle: string): string {
  const written = ctx.planTitles[handle];
  return written && written !== handle ? written : ctx.sentenceOf(handle);
}

/**
 * An enforced promise nothing has reported on: no signal, drawn grey and never
 * as holding (one-promise-language). The one reading of it — the row's dot and
 * the page's look state both ask here.
 *
 * promise: a-promise-is-upheld-or-broken
 */
export function readsNoSignal(
  row: Pick<DashboardRow, "standing" | "held">,
): boolean {
  return row.standing === "enforced" && row.held === null;
}

/** One row per promise, from the package's standing and thirty days, in words, with its plan's title and Path. */
export function buildRows(
  standing: StandingRow[],
  ctx: RowContext,
): DashboardRow[] {
  return standing.map((s) => {
    const name = s.entry.name;
    const path = innermostPath(ctx.declarations.subplans, s.entry.owner);
    return {
      name,
      sentence: ctx.sentenceOf(name),
      plan: s.entry.owner,
      planTitle: titled(ctx, s.entry.owner),
      path,
      pathTitle: path === null ? null : titled(ctx, path),
      standing: s.standing,
      tests: s.tests,
      held: s.thirtyDays.held,
      broke: s.thirtyDays.broke,
      lastActivity: s.lastActivity,
      lastBreak: s.lastBreak,
    };
  });
}

/** Rows whose sentence, name or plan contains the text, whatever the case. */
export function filterRows(rows: DashboardRow[], q: string): DashboardRow[] {
  const needle = q.toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    [r.sentence, r.name, r.planTitle, r.plan].some((t) =>
      t.toLowerCase().includes(needle),
    ),
  );
}

const STANDING_ORDER: Standing[] = [
  "broken",
  "being-proven",
  "declared",
  "enforced",
  "retired",
];

export const STANDING_LABELS: Record<Standing, string> = {
  broken: "Broken",
  "being-proven": "Being proven",
  declared: "Declared",
  enforced: "Enforced",
  retired: "Retired",
};

/** Newest first, a missing time last. */
const newestFirst = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? 1 : -1;

/** Broken before the rest, the latest break first; then the chosen sort. */
function compare(sort: Sorting) {
  return (a: DashboardRow, b: DashboardRow): number => {
    const broken =
      Number(b.standing === "broken") - Number(a.standing === "broken");
    if (broken) return broken;
    if (a.standing === "broken" && b.standing === "broken") {
      const byBreak = newestFirst(a.lastBreak, b.lastBreak);
      if (byBreak) return byBreak;
    }
    const byChoice =
      sort === "activity"
        ? newestFirst(a.lastActivity, b.lastActivity)
        : sort === "plan"
          ? a.planTitle.localeCompare(b.planTitle)
          : 0;
    return byChoice || a.name.localeCompare(b.name);
  };
}

export interface DashboardGroup {
  key: string;
  heading: string;
  rows: DashboardRow[];
}

export function groupRows(
  rows: DashboardRow[],
  query: Pick<DashboardQuery, "group" | "sort">,
  pathOrder: readonly string[] = [],
): DashboardGroup[] {
  const keyOf = (r: DashboardRow) =>
    query.group === "state"
      ? r.standing
      : query.group === "plan"
        ? r.plan
        : (r.path ?? "none");
  const headingOf = (r: DashboardRow) =>
    query.group === "state"
      ? STANDING_LABELS[r.standing]
      : query.group === "plan"
        ? r.planTitle
        : r.path
          ? (r.pathTitle ?? r.path)
          : "No Path";
  const groups = new Map<string, DashboardGroup>();
  for (const r of [...rows].sort(compare(query.sort))) {
    const key = keyOf(r);
    const group = groups.get(key) ?? { key, heading: headingOf(r), rows: [] };
    group.rows.push(r);
    groups.set(key, group);
  }
  const rank = (g: DashboardGroup): number => {
    if (query.group === "state")
      return STANDING_ORDER.indexOf(g.key as Standing);
    if (query.group === "path") {
      const at = pathOrder.indexOf(g.key);
      return g.key === "none"
        ? Number.MAX_SAFE_INTEGER
        : at < 0
          ? pathOrder.length
          : at;
    }
    return 0;
  };
  const holdsBroken = (g: DashboardGroup) =>
    g.rows.some((r) => r.standing === "broken");
  return [...groups.values()].sort(
    (a, b) =>
      Number(holdsBroken(b)) - Number(holdsBroken(a)) ||
      rank(a) - rank(b) ||
      a.heading.localeCompare(b.heading),
  );
}

/** How many promises stand at each standing, in the bar's order; standings nobody holds are absent. */
export function standingCounts(
  rows: DashboardRow[],
): Array<{ standing: Standing; count: number }> {
  return STANDING_ORDER.flatMap((standing) => {
    const count = rows.filter((r) => r.standing === standing).length;
    return count > 0 ? [{ standing, count }] : [];
  });
}
