"use client";

import { formatAge } from "@infinitedusky/indusk-mcp/promises/age";
import type {
  IncidentEntry,
  PromiseEntry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

/**
 * The promise page's incidents (incident-recording): each with how long it
 * has been open, or when it was fixed, and its owner's Maintenance phase while
 * it is open. Split from `Promises.tsx` at cleanup, one component per file.
 */

function incidentStatus(i: IncidentEntry, now: number): string {
  if (i.status === "fixed")
    return i.fixed ? `fixed ${i.fixed.slice(0, 10)}` : "fixed";
  if (!i.opened) return "open";
  return `open ${formatAge(now - Date.parse(i.opened))}`;
}

export function IncidentsTable({
  incidents,
  promises,
  planHrefPrefix,
  planTitles = {},
}: {
  incidents: IncidentEntry[];
  promises: PromiseEntry[];
  planHrefPrefix: string;
  /** Each owner plan by its title, as the Promises page names it; a handle with none reads as itself. */
  planTitles?: Record<string, string>;
}) {
  const now = Date.now();
  const ownerOf = (i: IncidentEntry) =>
    promises.find((p) => p.name === i.promise)?.owner ?? null;
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="promise-incident-list"
    >
      <h2 className="text-sm font-semibold text-ink-soft">Incidents</h2>
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
                <IncidentOwner
                  title={planTitles[ownerOf(i) ?? ""]}
                  incident={i}
                  owner={ownerOf(i)}
                  planHrefPrefix={planHrefPrefix}
                />
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

/** An incident's owner: a link naming its Maintenance phase while it is open, the plan's name once fixed. */
function IncidentOwner({
  incident,
  owner,
  title = owner ?? "",
  planHrefPrefix,
}: {
  incident: IncidentEntry;
  owner: string | null;
  /** The owner plan by its title. */
  title?: string;
  planHrefPrefix: string;
}) {
  if (!owner) return <span className="text-ink-faint">—</span>;
  if (incident.status !== "open") return <span>{title}</span>;
  return (
    <Link href={`${planHrefPrefix}${owner}`} className="hover:underline">
      {title} · Maintenance — {incident.id}
    </Link>
  );
}
