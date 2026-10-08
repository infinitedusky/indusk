"use client";

import type { HeardRow } from "@infinitedusky/indusk-mcp/promises/heard";
import type {
  IncidentEntry,
  PromiseEntry,
  PromiseState,
  RegistryProblem,
} from "@infinitedusky/indusk-mcp/promises/registry";
import Link from "next/link";
import { Fragment, useState } from "react";
import {
  PROMISE_KIND_LABELS,
  PROMISE_STATE_CHIP,
} from "@/components/bars/labels";
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
function incidentStatus(i: IncidentEntry, now: number): string {
  if (i.status === "fixed")
    return i.fixed ? `fixed ${i.fixed.slice(0, 10)}` : "fixed";
  if (!i.opened) return "open";
  return `open ${ageLabel(now - Date.parse(i.opened))}`;
}

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

/** `3 days`, `5 hours`, `40 minutes`. */
function ageLabel(ms: number): string {
  const plural = (n: number, unit: string) =>
    `${n} ${unit}${n === 1 ? "" : "s"}`;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return plural(days, "day");
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return plural(hours, "hour");
  return plural(Math.max(0, Math.floor(ms / 60_000)), "minute");
}

function IncidentsTable({
  incidents,
  promises,
  planHrefPrefix,
}: {
  incidents: IncidentEntry[];
  promises: PromiseEntry[];
  planHrefPrefix: string;
}) {
  const now = Date.now();
  const ownerOf = (i: IncidentEntry) =>
    promises.find((p) => p.name === i.promise)?.owner ?? null;
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="promise-incident-list"
    >
      <h2 className="text-sm font-semibold text-gray-700">Incidents</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>incident</TableHead>
            <TableHead>promise</TableHead>
            <TableHead>source</TableHead>
            <TableHead>status</TableHead>
            <TableHead>owner</TableHead>
            <TableHead>date</TableHead>
            <TableHead>symptom</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((i) => (
            <TableRow key={i.id} data-incident={i.id}>
              <TableCell>
                <code className="text-xs">{i.id}</code>
              </TableCell>
              <TableCell>
                <code className="text-xs">{i.promise}</code>
              </TableCell>
              <TableCell>{i.source}</TableCell>
              <TableCell data-testid="incident-status">
                {incidentStatus(i, now)}
              </TableCell>
              <TableCell>
                {(() => {
                  const owner = ownerOf(i);
                  if (!owner) return <span className="text-gray-400">—</span>;
                  return i.status === "open" ? (
                    <Link
                      href={`${planHrefPrefix}${owner}`}
                      className="hover:underline"
                    >
                      {owner} · Maintenance — {i.id}
                    </Link>
                  ) : (
                    <span>{owner}</span>
                  );
                })()}
              </TableCell>
              <TableCell>{i.date}</TableCell>
              <TableCell className="max-w-md">{i.symptom}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
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
