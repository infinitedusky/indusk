"use client";

import type { HeardRow } from "@infinitedusky/indusk-mcp/promises/heard";
import type {
  IncidentEntry,
  PromiseEntry,
  PromiseState,
  RegistryProblem,
} from "@infinitedusky/indusk-mcp/promises/registry";
import type { Standing } from "@infinitedusky/indusk-mcp/promises/standing";
import Link from "next/link";
import { Fragment, useState } from "react";
import {
  PROMISE_KIND_LABELS,
  PROMISE_STATE_CHIP,
} from "@/components/bars/labels";
import { IncidentsTable } from "@/components/IncidentsTable";
import {
  GREY,
  HealthChip,
  HealthDetail,
  SourceBanner,
  type SourceChip,
  type SourceObserved,
} from "@/components/PromiseHealth";
import {
  PromiseTimeline,
  TimelineControls,
  TimelineEmpty,
} from "@/components/PromiseTimeline";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  type DashboardQuery,
  type DashboardRow,
  filterRows,
  GROUPINGS,
  groupRows,
  SORTINGS,
  STANDING_LABELS,
  standingCounts,
} from "@/lib/promise-dashboard";
import type { HeardRecord } from "@/lib/promises-reader";
import type { Strip, TimelineView } from "@/lib/timeline-strip";

/**
 * The Promises page's pieces (day-promises, ADR D8): the registry as a table
 * grouped by owner plan, domain, state or kind; a chip per promise that
 * shows DECLARED STATE ONLY; the "holding N" badge the sidebar and the plan
 * header carry; the error block for a malformed entry; the empty state for a
 * project with no registry.
 *
 * The declared-state chip never carries health: an `enforced` chip is hollow
 * by construction. Observed health is a second chip beside it (day-monitor,
 * ADR D9), drawn only from what the page read from telemetry — `observed` —
 * except `retired`, which is grey whatever anyone saw.
 */

export type PromiseGrouping = "owner" | "domain" | "state" | "kind";

export const PROMISE_GROUPINGS: ReadonlyArray<{
  key: PromiseGrouping;
  label: string;
}> = [
  { key: "owner", label: "by plan" },
  { key: "domain", label: "by domain" },
  { key: "state", label: "by state" },
  { key: "kind", label: "by kind" },
];

/** A promise's declared state as a chip. Hollow when enforced: declared, not yet observed. */
export function PromiseChip({ state }: { state: PromiseState }) {
  const chip = PROMISE_STATE_CHIP[state];
  return (
    <span
      role="img"
      data-testid="promise-chip"
      data-state={state}
      aria-label={chip.aria}
      title={chip.aria}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

function groupKey(p: PromiseEntry, by: PromiseGrouping): string {
  switch (by) {
    case "owner":
      return p.owner;
    case "domain":
      return p.domain;
    case "state":
      return p.state;
    case "kind":
      return p.kind;
  }
}

function groupBy(
  promises: PromiseEntry[],
  by: PromiseGrouping,
  isRed: (p: PromiseEntry) => boolean = () => false,
): Array<[key: string, rows: PromiseEntry[]]> {
  const groups = new Map<string, PromiseEntry[]>();
  for (const p of promises) {
    const key = groupKey(p, by);
    const rows = groups.get(key) ?? [];
    rows.push(p);
    groups.set(key, rows);
  }
  // Red sorts first (day-monitor, A21): within a group, and a group holding
  // a red promise before one that holds none.
  const redFirst = (a: PromiseEntry, b: PromiseEntry) =>
    Number(isRed(b)) - Number(isRed(a)) || a.name.localeCompare(b.name);
  return [...groups.entries()]
    .sort(
      ([ka, ra], [kb, rb]) =>
        Number(rb.some(isRed)) - Number(ra.some(isRed)) || ka.localeCompare(kb),
    )
    .map(([key, rows]) => [key, [...rows].sort(redFirst)]);
}

export interface PromisesTableProps {
  promises: PromiseEntry[];
  incidents: IncidentEntry[];
  /** Route prefix for an owner plan's link, e.g. `/p/dusk/plan/`. */
  planHrefPrefix?: string;
  initialGroupBy?: PromiseGrouping;
  /**
   * What the page read from telemetry (day-monitor, ADR D9), one entry per
   * source (promise-sources, ADR D7): a health row per promise, and — only
   * when that source could not be read — when it last could. Absent: no read
   * was made, and no observed health is drawn.
   */
  observed?: SourceObserved[];
  /**
   * Each behaviour promise's history for one source and window
   * (promise-timeline, ADR D6), drawn under its row. Absent: no timeline.
   */
  timelines?: TimelineView;
  /** The page's own path, e.g. `/p/dusk/promises`, for the window and source switches. */
  timelinePath?: string;
  /**
   * What this machine's recorder heard (incident-recording, ADR D6): each
   * promise's production breaks are counted from it, past the source's
   * retention and whether or not a page was open. Absent: no count is drawn.
   */
  heard?: HeardRecord;
}

/** The window the page counts heard breaks over: longer than a Jaeger keeps. */
const HEARD_WINDOW_MS = 30 * 86_400_000;

export function PromisesTable({
  promises,
  incidents,
  planHrefPrefix = "/plan/",
  initialGroupBy = "owner",
  observed,
  timelines,
  timelinePath,
  heard,
}: PromisesTableProps) {
  const [by, setBy] = useState<PromiseGrouping>(initialGroupBy);
  const [showRetired, setShowRetired] = useState(false);
  const retiredCount = promises.filter((p) => p.state === "retired").length;
  const visible = showRetired
    ? promises
    : promises.filter((p) => p.state !== "retired");
  const sources = observed ?? [];
  // While production cannot be read, a count is as of the last time it was heard.
  const productionUnread = sources.some(
    (o) => o.name === "production" && o.unknownSince !== undefined,
  );
  const heardCounts = heard
    ? countHeardSince(heard.rows, HEARD_WINDOW_MS)
    : null;
  const heardLabelOf =
    heard && heardCounts
      ? (name: string) =>
          heardLabel(
            heardCounts.get(name) ?? 0,
            productionUnread ? heard.lastHeard : null,
          )
      : undefined;
  // Retired is grey whatever any source says: one chip, no source.
  const chipsOf = (p: PromiseEntry): SourceChip[] =>
    p.state === "retired"
      ? [{ source: sources[0]?.name ?? "local", row: GREY }]
      : sources.flatMap((o) => {
          const row = o.rows[p.name];
          return row
            ? [{ source: o.name, row, unknownSince: o.unknownSince }]
            : [];
        });
  // Red in any source sorts first: a local break is shown, though only the
  // alarm source marks the sidebar.
  const groups = groupBy(visible, by, (p) =>
    chipsOf(p).some((c) => c.row.health === "red"),
  );
  const labelled = sources.length > 1;

  return (
    <section className="flex flex-col gap-4" data-testid="promises">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900">Promises</h1>
        <p className="text-sm text-gray-600">
          What the system commits to, from <code>.indusk/promises/</code>. The
          first chip is a <em>declared</em> state, so an enforced promise is
          drawn hollow.
          {!observed
            ? " Nothing here has observed the running system."
            : labelled
              ? ` Beside it, a behaviour promise shows what each source saw over the quiet window — ${sources.map((o) => o.name).join(" and ")}: violated, upheld, or unverified when no run marked it.`
              : " Beside it, a behaviour promise shows what the local Jaeger saw over the quiet window: violated, upheld, or unverified when no run marked it."}
        </p>
      </header>

      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="promises-controls"
      >
        {PROMISE_GROUPINGS.map((g) => (
          <Button
            key={g.key}
            size="sm"
            variant={by === g.key ? "primary" : "secondary"}
            aria-pressed={by === g.key}
            data-grouping={g.key}
            onClick={() => setBy(g.key)}
          >
            {g.label}
          </Button>
        ))}
        {retiredCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showRetired}
            onClick={() => setShowRetired((v) => !v)}
          >
            {showRetired ? "Hide retired" : `Show retired (${retiredCount})`}
          </Button>
        )}
      </div>

      {sources.map((o) => (
        <SourceBanner key={o.name} observed={o} />
      ))}

      {timelines && timelinePath && (
        <TimelineControls timelines={timelines} path={timelinePath} />
      )}

      {groups.map(([key, rows]) => (
        <PromiseGroup
          key={key}
          groupKey={key}
          rows={rows}
          linkGroup={by === "owner"}
          planHrefPrefix={planHrefPrefix}
          chipsOf={chipsOf}
          labelled={labelled}
          timelines={timelines}
          heardLabelOf={heardLabelOf}
        />
      ))}

      {incidents.length > 0 && (
        <IncidentsTable
          incidents={incidents}
          promises={promises}
          planHrefPrefix={planHrefPrefix}
        />
      )}
    </section>
  );
}

/** One grouping's section: its heading (a plan link when grouped by owner) and the rows table. */
function PromiseGroup({
  groupKey,
  rows,
  linkGroup,
  planHrefPrefix,
  chipsOf,
  labelled,
  timelines,
  heardLabelOf,
}: {
  groupKey: string;
  rows: PromiseEntry[];
  linkGroup: boolean;
  planHrefPrefix: string;
  chipsOf: (p: PromiseEntry) => SourceChip[];
  labelled: boolean;
  timelines?: TimelineView;
  /** Each promise's count from the heard record; absent, no column is drawn. */
  heardLabelOf?: (name: string) => string;
}) {
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="promise-group"
      data-group={groupKey}
    >
      <h2 className="text-sm font-semibold text-gray-700">
        {linkGroup ? (
          <Link
            href={`${planHrefPrefix}${groupKey}`}
            className="hover:underline"
          >
            {groupKey}
          </Link>
        ) : (
          groupKey
        )}
        <span className="ml-2 font-normal text-gray-400">{rows.length}</span>
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>state</TableHead>
            <TableHead>promise</TableHead>
            <TableHead>statement</TableHead>
            <TableHead>kind</TableHead>
            <TableHead>domain</TableHead>
            <TableHead>owner</TableHead>
            <TableHead>sites</TableHead>
            <TableHead>tests</TableHead>
            <TableHead>incidents</TableHead>
            {heardLabelOf && <TableHead>heard (30 days)</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <Fragment key={p.name}>
              <TableRow
                data-testid="promise-row"
                data-promise={p.name}
                id={`promise-${p.name}`}
              >
                <TableCell>
                  <PromiseStateCell
                    promise={p}
                    chips={chipsOf(p)}
                    labelled={labelled}
                  />
                </TableCell>
                <TableCell>
                  <code className="text-xs">{p.name}</code>
                </TableCell>
                <TableCell className="max-w-md">{p.statement}</TableCell>
                <TableCell>{PROMISE_KIND_LABELS[p.kind]}</TableCell>
                <TableCell>{p.domain}</TableCell>
                <TableCell>
                  <Link
                    href={`${planHrefPrefix}${p.owner}`}
                    className="hover:underline"
                  >
                    {p.owner}
                  </Link>
                </TableCell>
                <TableCell>
                  <PathList paths={p.sites} />
                </TableCell>
                <TableCell>
                  <PathList paths={p.tests} />
                </TableCell>
                <TableCell data-testid="promise-incidents">
                  <PathList paths={p.incidents} />
                </TableCell>
                {heardLabelOf && (
                  <TableCell data-testid="promise-heard" data-promise={p.name}>
                    {heardLabelOf(p.name)}
                  </TableCell>
                )}
              </TableRow>
              {timelines && !timelines.failure && timelines.strips[p.name] && (
                <TableRow data-testid="promise-timeline-row">
                  <TableCell colSpan={heardLabelOf ? 10 : 9}>
                    {timelines.strips[p.name] === "empty" ? (
                      <TimelineEmpty />
                    ) : (
                      <PromiseTimeline
                        promise={p.name}
                        source={timelines.source}
                        strip={timelines.strips[p.name] as Strip}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

/**
 * The state cell: declared state, observed health beside it — one chip per
 * source, labelled when there is more than one — and a detail line each.
 */
function PromiseStateCell({
  promise,
  chips,
  labelled,
}: {
  promise: PromiseEntry;
  chips: SourceChip[];
  labelled: boolean;
}) {
  const named = labelled && promise.state !== "retired";
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <PromiseChip state={promise.state} />
        {chips.map((c) => (
          <HealthChip
            key={c.source}
            row={c.row}
            unknownSince={c.unknownSince}
            source={c.source}
            labelled={named}
          />
        ))}
      </span>
      {chips.map((c) => (
        <HealthDetail
          key={c.source}
          row={c.row}
          unknownSince={c.unknownSince}
          {...(named ? { source: c.source } : {})}
        />
      ))}
    </div>
  );
}

/** Every incident in the registry, after the promises. */
/**
 * How long an incident has been open, or when it was fixed
 * (incident-recording A12): an open incident is work someone saw and nobody
 * finished, and its age is what keeps it loud.
 */
/** Breaks per promise in the record over the last `windowMs`. */
function countHeardSince(
  rows: HeardRow[],
  windowMs: number,
): Map<string, number> {
  const since = Date.now() - windowMs;
  const out = new Map<string, number>();
  for (const r of rows) {
    if (Date.parse(r.at) < since) continue;
    out.set(r.promise, (out.get(r.promise) ?? 0) + 1);
  }
  return out;
}

/**
 * A count heard, or none; while production cannot be read, as of the last
 * time anything was heard — a count the admin could not refresh is never
 * shown as a fresh zero (A22).
 */
function heardLabel(count: number, asOf: string | null): string {
  const what = count > 0 ? `${count} heard` : "none heard";
  return asOf ? `${what} · as of ${asOf.replace("T", " ").slice(0, 16)}` : what;
}

/** A list of paths or ids as code, or a dash for none. */
function PathList({ paths }: { paths: string[] }) {
  if (paths.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {paths.map((p) => (
        <li key={p}>
          <code className="text-xs">{p}</code>
        </li>
      ))}
    </ul>
  );
}

/** A malformed entry, named — never skipped, never an empty table in its place. */
export function PromisesProblems({
  problems,
}: {
  problems: RegistryProblem[];
}) {
  return (
    <div
      role="alert"
      data-testid="promises-problems"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <p className="font-medium">
        {problems.length === 1
          ? "One registry entry could not be read:"
          : `${problems.length} registry entries could not be read:`}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {problems.map((p) => (
          <li key={p.file}>
            <code className="text-xs">.indusk/promises/{p.file}</code> —{" "}
            {p.problem}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-red-700">
        Run <code>indusk promises check</code> for the same list on the command
        line. The well-formed entries are listed below.
      </p>
    </div>
  );
}

/** No registry yet. Says where one goes and how to check it. */
export function PromisesEmpty({ dir }: { dir: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid="promises-empty">
      <h1 className="text-xl font-semibold text-gray-900">Promises</h1>
      <p className="text-sm text-gray-600">
        This project has no promise registry yet: nothing under{" "}
        <code>.indusk/promises/</code> (looked at <code>{dir}</code>).
      </p>
      <p className="text-sm text-gray-600">
        Write one markdown file per promise there, declare its domain under{" "}
        <code>promises.domains</code> in <code>.indusk/config.json</code>, and
        run <code>indusk promises check</code>. The file shapes and every
        refusal are in the reference page <code>/reference/cli/promises</code>.
      </p>
    </section>
  );
}

const STANDING_STYLE: Record<Standing, { bar: string; chip: string }> = {
  broken: { bar: "bg-red-600", chip: "border-red-300 bg-red-50 text-red-800" },
  "being-proven": {
    bar: "bg-amber-500",
    chip: "border-amber-300 bg-amber-50 text-amber-800",
  },
  declared: {
    bar: "bg-gray-400",
    chip: "border-dashed border-gray-400 bg-white text-gray-600",
  },
  enforced: {
    bar: "bg-green-600",
    chip: "border-green-600 bg-white text-green-700",
  },
  retired: {
    bar: "bg-gray-200",
    chip: "border-gray-200 bg-gray-50 text-gray-400",
  },
};

export interface PromisesDashboardProps {
  /** Every promise of the project with its standing, unfiltered. */
  rows: DashboardRow[];
  query: DashboardQuery;
  /** Paths of the master files' Paths in declared order, for ordering Path groups. */
  pathOrder: readonly string[];
  incidents: IncidentEntry[];
  promises: PromiseEntry[];
  /** The dashboard's own path, e.g. `/p/dusk/promises`; the controls link back to it. */
  path: string;
  planHrefPrefix: string;
  /** Observed health per source, for the banners that say a source could not be read. */
  observed?: SourceObserved[];
  timelines?: TimelineView;
}

/**
 * The promises dashboard (plan-cockpit, ADR decision 5): a stacked bar of
 * standings, then every promise grouped, sorted and filtered by what the URL
 * carries — links and a GET form, no state of its own — broken first. The
 * incidents and the per-source timeline follow beneath.
 */
export function PromisesDashboard({
  rows,
  query,
  pathOrder,
  incidents,
  promises,
  path,
  planHrefPrefix,
  observed = [],
  timelines,
}: PromisesDashboardProps) {
  const shown = filterRows(rows, query.q);
  const groups = groupRows(shown, query, pathOrder);
  const counts = standingCounts(rows);
  const hrefWith = (change: Partial<DashboardQuery>) => {
    const next = { ...query, ...change };
    const params = new URLSearchParams();
    params.set("group", next.group);
    params.set("sort", next.sort);
    if (next.q) params.set("q", next.q);
    return `${path}?${params.toString()}`;
  };
  const strips = timelines && !timelines.failure ? timelines.strips : {};
  const timelineRows = rows.filter((r) => strips[r.name]);

  return (
    <section className="flex flex-col gap-4" data-testid="promises">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-gray-900">Promises</h1>
        <div
          className="flex h-3 w-full overflow-hidden rounded bg-gray-100"
          data-testid="standing-bar"
          role="img"
          aria-label={counts
            .map((c) => `${c.count} ${STANDING_LABELS[c.standing]}`)
            .join(", ")}
        >
          {counts.map((c) => (
            <span
              key={c.standing}
              data-standing={c.standing}
              className={STANDING_STYLE[c.standing].bar}
              style={{ flex: c.count }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {counts.map((c) => (
            <li key={c.standing} data-testid="standing-count">
              <span
                className={`mr-1 inline-block h-2 w-2 rounded-full ${STANDING_STYLE[c.standing].bar}`}
              />
              {c.count} {STANDING_LABELS[c.standing].toLowerCase()}
            </li>
          ))}
        </ul>
      </header>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
        data-testid="promises-controls"
      >
        <ControlLinks
          label="Group"
          options={GROUPINGS}
          current={query.group}
          hrefFor={(key) => hrefWith({ group: key })}
        />
        <ControlLinks
          label="Sort"
          options={SORTINGS}
          current={query.sort}
          hrefFor={(key) => hrefWith({ sort: key })}
        />
        <form method="get" action={path} className="flex items-center gap-2">
          <input type="hidden" name="group" value={query.group} />
          <input type="hidden" name="sort" value={query.sort} />
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Filter by sentence, name or plan"
            aria-label="Filter promises"
            className="w-64 max-w-full rounded border border-gray-300 px-2 py-1"
          />
          <Button size="sm" variant="secondary" type="submit">
            Filter
          </Button>
        </form>
      </div>

      {observed.map((o) => (
        <SourceBanner key={o.name} observed={o} />
      ))}

      {groups.length === 0 && (
        <p className="text-sm text-gray-600" data-testid="promises-none">
          No promise matches “{query.q}”.
        </p>
      )}
      {groups.map((g) => (
        <section
          key={g.key}
          className="flex flex-col gap-2"
          data-testid="promise-group"
          data-group={g.key}
        >
          <h2 className="text-sm font-semibold text-gray-700">
            {query.group === "plan" ? (
              <Link
                href={`${planHrefPrefix}${g.key}`}
                className="hover:underline"
              >
                {g.heading}
              </Link>
            ) : (
              g.heading
            )}
            <span className="ml-2 font-normal text-gray-400">
              {g.rows.length}
            </span>
          </h2>
          <ul className="flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
            {g.rows.map((r) => (
              <DashboardRowItem
                key={r.name}
                row={r}
                planHrefPrefix={planHrefPrefix}
              />
            ))}
          </ul>
        </section>
      ))}

      {timelines && (
        <section
          className="flex flex-col gap-2"
          data-testid="promises-timeline"
        >
          <TimelineControls timelines={timelines} path={path} />
          {timelineRows.map((r) => (
            <div key={r.name} className="flex flex-col gap-0.5">
              <code className="text-xs text-gray-600">{r.name}</code>
              {strips[r.name] === "empty" ? (
                <TimelineEmpty />
              ) : (
                <PromiseTimeline
                  promise={r.name}
                  source={timelines.source}
                  strip={strips[r.name] as Strip}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {incidents.length > 0 && (
        <IncidentsTable
          incidents={incidents}
          promises={promises}
          planHrefPrefix={planHrefPrefix}
        />
      )}
    </section>
  );
}

function ControlLinks<K extends string>({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: ReadonlyArray<{ key: K; label: string }>;
  current: K;
  hrefFor: (key: K) => string;
}) {
  return (
    <span
      className="flex items-center gap-1"
      data-control={label.toLowerCase()}
    >
      <span className="text-gray-500">{label}</span>
      {options.map((o) => (
        <Link
          key={o.key}
          href={hrefFor(o.key)}
          aria-current={o.key === current ? "true" : undefined}
          data-option={o.key}
          className={`rounded px-2 py-0.5 ${
            o.key === current
              ? "bg-gray-900 text-white"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </span>
  );
}

/** One promise: its standing, its sentence in words, its name and plan, its tests, thirty days, last activity. */
function DashboardRowItem({
  row,
  planHrefPrefix,
}: {
  row: DashboardRow;
  planHrefPrefix: string;
}) {
  return (
    <li
      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-3 py-2"
      data-testid="promise-row"
      data-promise={row.name}
      data-standing={row.standing}
      id={`promise-${row.name}`}
    >
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STANDING_STYLE[row.standing].chip}`}
      >
        {STANDING_LABELS[row.standing].toLowerCase()}
      </span>
      <span className="flex min-w-0 flex-1 basis-64 flex-col">
        <span className="text-sm font-medium text-gray-900">
          {row.sentence}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-gray-500">
          <code>{row.name}</code>
          <Link
            href={`${planHrefPrefix}${row.plan}`}
            className="hover:underline"
          >
            {row.planTitle}
          </Link>
        </span>
      </span>
      <span className="text-xs text-gray-600" data-testid="promise-tests">
        {row.tests.total === 0
          ? "no tests"
          : `${row.tests.passing}/${row.tests.total} tests passing`}
      </span>
      <span className="text-xs text-gray-600" data-testid="promise-thirty">
        {row.held === null
          ? "not seen yet"
          : `held ${row.held} · broke ${row.broke} of 30 days`}
      </span>
      <span className="text-xs text-gray-500" data-testid="promise-activity">
        {row.lastActivity
          ? `seen ${row.lastActivity.replace("T", " ").slice(0, 16)}`
          : "never seen"}
      </span>
    </li>
  );
}
