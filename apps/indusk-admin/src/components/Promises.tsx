"use client";

import type {
  IncidentEntry,
  PromiseEntry,
  PromiseState,
  RegistryProblem,
} from "@infinitedusky/indusk-mcp/promises/registry";
import Link from "next/link";
import { useState } from "react";
import {
  PROMISE_KIND_LABELS,
  PROMISE_STATE_CHIP,
} from "@/components/bars/labels";
import { GREY, HealthChip, HealthDetail } from "@/components/PromiseHealth";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { HealthRow } from "@/lib/promise-health";

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
   * What the page read from telemetry (day-monitor, ADR D9): a health row per
   * promise, and — only when Jaeger could not be read — when it last could.
   * Absent: no read was made, and no observed health is drawn.
   */
  observed?: { rows: Record<string, HealthRow>; unknownSince?: string | null };
}

export function PromisesTable({
  promises,
  incidents,
  planHrefPrefix = "/plan/",
  initialGroupBy = "owner",
  observed,
}: PromisesTableProps) {
  const [by, setBy] = useState<PromiseGrouping>(initialGroupBy);
  const [showRetired, setShowRetired] = useState(false);
  const retiredCount = promises.filter((p) => p.state === "retired").length;
  const visible = showRetired
    ? promises
    : promises.filter((p) => p.state !== "retired");
  const rowOf = (p: PromiseEntry): HealthRow | null =>
    p.state === "retired" ? GREY : (observed?.rows[p.name] ?? null);
  const groups = groupBy(visible, by, (p) => rowOf(p)?.health === "red");

  return (
    <section className="flex flex-col gap-4" data-testid="promises">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900">Promises</h1>
        <p className="text-sm text-gray-600">
          What the system commits to, from <code>.indusk/promises/</code>. The
          first chip is a <em>declared</em> state, so an enforced promise is
          drawn hollow.
          {observed
            ? " Beside it, a behaviour promise shows what the local Jaeger saw over the quiet window: violated, upheld, or unverified when no run marked it."
            : " Nothing here has observed the running system."}
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

      {observed && observed.unknownSince !== undefined && (
        <p
          className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          data-testid="health-unknown"
        >
          The local Jaeger could not be read — health unknown since{" "}
          {observed.unknownSince ?? "this server started"}. No promise is shown
          upheld.
        </p>
      )}

      {groups.map(([key, rows]) => (
        <PromiseGroup
          key={key}
          groupKey={key}
          rows={rows}
          linkGroup={by === "owner"}
          planHrefPrefix={planHrefPrefix}
          rowOf={rowOf}
          unknownSince={observed?.unknownSince}
        />
      ))}

      {incidents.length > 0 && <IncidentsTable incidents={incidents} />}
    </section>
  );
}

/** One grouping's section: its heading (a plan link when grouped by owner) and the rows table. */
function PromiseGroup({
  groupKey,
  rows,
  linkGroup,
  planHrefPrefix,
  rowOf,
  unknownSince,
}: {
  groupKey: string;
  rows: PromiseEntry[];
  linkGroup: boolean;
  planHrefPrefix: string;
  rowOf: (p: PromiseEntry) => HealthRow | null;
  unknownSince?: string | null;
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow
              key={p.name}
              data-testid="promise-row"
              data-promise={p.name}
            >
              <TableCell>
                <PromiseStateCell
                  promise={p}
                  row={rowOf(p)}
                  unknownSince={unknownSince}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

/** The state cell: declared state, observed health beside it, and the detail line. */
function PromiseStateCell({
  promise,
  row,
  unknownSince,
}: {
  promise: PromiseEntry;
  row: HealthRow | null;
  unknownSince?: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-1">
        <PromiseChip state={promise.state} />
        {row && <HealthChip row={row} unknownSince={unknownSince} />}
      </span>
      {row && <HealthDetail row={row} unknownSince={unknownSince} />}
    </div>
  );
}

/** Every incident in the registry, after the promises. */
function IncidentsTable({ incidents }: { incidents: IncidentEntry[] }) {
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
              <TableCell>{i.status}</TableCell>
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
