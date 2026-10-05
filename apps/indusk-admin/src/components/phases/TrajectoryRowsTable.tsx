import type { TrajectoryRow } from "@infinitedusky/indusk-mcp/trajectory/parser";
import { phaseTitle } from "@/components/bars/labels";
import { Badge } from "@/components/ui/Badge";
import { stateToBadge } from "@/components/ui/badge-variant";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

/**
 * A phase's trajectory rows, in one of two forms (admin-ui-phase-progress
 * cleanup, A34): the ritual sections show ID / Asserts / State; the
 * Implementation Plan adds Writable at / Passes at. This table was written
 * three times before it had a name.
 *
 * Phases are spelled the admin's way (`Test Phase 1`, `Phase 2`) — the same
 * spelling every heading on the page uses — through `phaseTitle`, never the
 * package's `phaseLabel` (A36).
 *
 * Level and For appear when a row has them (planner-promises A7): the level
 * the test runs at, and what it is for — as the package's parser read them,
 * never re-read here. An impl written before rows said so keeps its columns.
 */
export function TrajectoryRowsTable({
  rows,
  phaseColumns = false,
  promisesHref,
}: {
  rows: TrajectoryRow[];
  /** Add the Writable at / Passes at columns. */
  phaseColumns?: boolean;
  /** The project's Promises page; a promise's name links to it there. */
  promisesHref?: string;
}) {
  if (rows.length === 0) return null;
  const hasLevel = rows.some((row) => row.levelText);
  const hasPurpose = rows.some((row) => row.purpose);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Asserts</TableHead>
          {phaseColumns && <TableHead>Writable at</TableHead>}
          {phaseColumns && <TableHead>Passes at</TableHead>}
          {hasLevel && <TableHead>Level</TableHead>}
          {hasPurpose && <TableHead>For</TableHead>}
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="font-mono text-xs">{row.id}</span>
            </TableCell>
            <TableCell>{row.asserts}</TableCell>
            {phaseColumns && (
              <TableCell>
                {phaseTitle({
                  kind: row.writableAtKind,
                  number: row.writableAt,
                })}
              </TableCell>
            )}
            {phaseColumns && (
              <TableCell>
                {phaseTitle({ kind: row.passesAtKind, number: row.passesAt })}
              </TableCell>
            )}
            {hasLevel && <TableCell>{row.levelText ?? ""}</TableCell>}
            {hasPurpose && (
              <TableCell>
                <RowPurpose purpose={row.purpose} promisesHref={promisesHref} />
              </TableCell>
            )}
            <TableCell>
              <Badge variant={stateToBadge(row.state)}>{row.state}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** What a row is for: the promises it proves, the lessons it guards, or its reason. */
function RowPurpose({
  purpose,
  promisesHref,
}: {
  purpose: TrajectoryRow["purpose"];
  promisesHref?: string;
}) {
  if (!purpose) return null;
  if (purpose.reason !== null) return <>{purpose.reason}</>;
  return (
    <ul className="flex flex-col gap-0.5">
      {purpose.promises.map((name) => (
        <li key={`promise-${name}`} data-purpose="promise">
          <span className="text-gray-500">promise </span>
          {promisesHref ? (
            <a
              href={`${promisesHref}#promise-${name}`}
              className="font-mono text-xs text-blue-700 hover:underline"
            >
              {name}
            </a>
          ) : (
            <span className="font-mono text-xs">{name}</span>
          )}
        </li>
      ))}
      {purpose.lessons.map((name) => (
        <li key={`lesson-${name}`} data-purpose="lesson">
          <span className="text-gray-500">lesson </span>
          <span className="font-mono text-xs">{name}</span>
        </li>
      ))}
    </ul>
  );
}
