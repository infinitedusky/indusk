"use client";

import type {
  IncidentEntry,
  PromiseEntry,
  RegistryProblem,
} from "@infinitedusky/indusk-mcp/promises/registry";
import type { LookRow } from "@infinitedusky/indusk-mcp/promises/standing";
import Link from "next/link";
import { STANDING_STYLE } from "@/components/bars/labels";
import { IncidentsTable } from "@/components/IncidentsTable";
import { LooksOnDashboard } from "@/components/looks/LooksOnDashboard";
import { SourceBanner, type SourceObserved } from "@/components/PromiseHealth";
import {
  PromiseTimeline,
  TimelineControls,
  TimelineEmpty,
} from "@/components/PromiseTimeline";
import { Button } from "@/components/ui/Button";
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
import { stamp } from "@/lib/stamp";
import type { Strip, TimelineView } from "@/lib/timeline-strip";

/**
 * The Promises page's pieces (day-promises, ADR D8; plan-cockpit, ADR decision
 * 5): the dashboard of every promise by standing, the error block for a
 * malformed entry, and the empty state for a project with no registry.
 */

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
  /** Route prefix for a promise's own page, e.g. `/p/dusk/promises/`. */
  promiseHrefPrefix: string;
  /** Observed health per source, for the banners that say a source could not be read. */
  observed?: SourceObserved[];
  timelines?: TimelineView;
  /** Each look's standing, `promises/standing`'s; broken ones are listed above the promises. */
  looks?: LookRow[];
  /** The Looks page, which the looks' line links to. */
  looksHref?: string;
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
  promiseHrefPrefix,
  observed = [],
  timelines,
  looks = [],
  looksHref = "",
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

      <LooksOnDashboard looks={looks} href={looksHref} />

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
                promiseHrefPrefix={promiseHrefPrefix}
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

/** One promise, shown as its standing, its sentence in words, its name and plan, its tests, thirty days, last activity. */
function DashboardRowItem({
  row,
  planHrefPrefix,
  promiseHrefPrefix,
}: {
  row: DashboardRow;
  planHrefPrefix: string;
  promiseHrefPrefix: string;
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
        <Link
          href={`${promiseHrefPrefix}${row.name}`}
          data-testid="promise-link"
          className="text-sm font-medium text-gray-900 hover:underline"
        >
          {row.sentence}
        </Link>
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
        {row.lastActivity ? `seen ${stamp(row.lastActivity)}` : "never seen"}
      </span>
    </li>
  );
}
