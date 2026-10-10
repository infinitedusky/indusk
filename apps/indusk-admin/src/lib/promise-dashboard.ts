import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import { promiseWords } from "@infinitedusky/indusk-mcp/promises/display";
import type { HeardRow } from "@infinitedusky/indusk-mcp/promises/heard";
import type {
  Standing,
  StandingRow,
} from "@infinitedusky/indusk-mcp/promises/standing";

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
  standing: Standing;
  tests: { passing: number; total: number };
  /** Days of the last thirty not broken; null while the promise has never been seen. */
  held: number | null;
  /** Violations heard in the last thirty days. */
  broke: number;
  lastActivity: string | null;
  /** The newest break: a heard violation, or the alarm source's last sighting while broken. */
  lastBreak: string | null;
}

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export interface RowContext {
  planTitles: Record<string, string>;
  words: Record<string, string>;
  declarations: Pick<PlanDeclarations, "subplans">;
  heard: HeardRow[];
  now: number;
}

/** The innermost Path whose declared plans include `plan`. */
function pathOf(
  subplans: PlanDeclarations["subplans"],
  plan: string,
): string | null {
  for (const [path, plans] of Object.entries(subplans)) {
    if (plans.includes(plan)) return path;
  }
  return null;
}

export function buildRows(
  standing: StandingRow[],
  ctx: RowContext,
): DashboardRow[] {
  const since = ctx.now - WINDOW_DAYS * DAY_MS;
  return standing.map((s) => {
    const name = s.entry.name;
    const heard = ctx.heard.filter(
      (h) => h.promise === name && Date.parse(h.at) >= since,
    );
    const heardLatest = heard.reduce<string | null>(
      (latest, h) => (latest === null || h.at > latest ? h.at : latest),
      null,
    );
    const lastBreak =
      s.standing === "broken" &&
      s.lastActivity &&
      (!heardLatest || s.lastActivity > heardLatest)
        ? s.lastActivity
        : heardLatest;
    const brokenDays = new Set(heard.map((h) => h.at.slice(0, 10))).size;
    return {
      name,
      sentence: promiseWords(name, ctx.words),
      plan: s.entry.owner,
      planTitle: ctx.planTitles[s.entry.owner] ?? s.entry.owner,
      path: pathOf(ctx.declarations.subplans, s.entry.owner),
      standing: s.standing,
      tests: s.tests,
      held: s.lastActivity || heard.length ? WINDOW_DAYS - brokenDays : null,
      broke: heard.length,
      lastActivity: s.lastActivity,
      lastBreak,
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
          ? r.path
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
