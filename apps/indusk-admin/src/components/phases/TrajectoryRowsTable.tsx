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
 */
export function TrajectoryRowsTable({
  rows,
  phaseColumns = false,
}: {
  rows: TrajectoryRow[];
  /** Add the Writable at / Passes at columns. */
  phaseColumns?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Asserts</TableHead>
          {phaseColumns && <TableHead>Writable at</TableHead>}
          {phaseColumns && <TableHead>Passes at</TableHead>}
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
            <TableCell>
              <Badge variant={stateToBadge(row.state)}>{row.state}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
