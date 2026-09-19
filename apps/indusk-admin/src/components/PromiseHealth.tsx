import { PROMISE_HEALTH_CHIP } from "@/components/bars/labels";
import type { HealthRow } from "@/lib/promise-health";

/**
 * The observed-health axis of the Promises page (day-monitor, ADR D9), beside
 * the declared-state chip: the health chip and the detail line under it.
 * Split out of `Promises.tsx` at cleanup — one component per file for the
 * second axis; `Promises.tsx` composes both in its state cell.
 */

/** Observed health as a chip, beside the declared state (day-monitor, ADR D9). */
export function HealthChip({
  row,
  unknownSince,
}: {
  row: HealthRow;
  /** Set when Jaeger could not be read: when it last could, or null for never. */
  unknownSince?: string | null;
}) {
  const chip = PROMISE_HEALTH_CHIP[row.health];
  const aria =
    unknownSince !== undefined && row.health === "unverified"
      ? `health unknown since ${unknownSince ?? "this server started"}`
      : chip.aria;
  return (
    <span
      role="img"
      data-testid="promise-health"
      data-health={row.health}
      aria-label={aria}
      title={aria}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

function day(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** The line under a behaviour promise's chips: violations in the window and last seen. */
export function HealthDetail({
  row,
  unknownSince,
}: {
  row: HealthRow;
  unknownSince?: string | null;
}) {
  if (row.health === "grey") return null;
  const parts: string[] = [];
  if (row.violations !== null && row.violations > 0) {
    parts.push(
      `${row.atLeast ? "at least " : ""}${row.violations} violation${row.violations === 1 ? "" : "s"}`,
    );
  }
  if (row.lastSeen) parts.push(`last seen ${day(row.lastSeen)}`);
  else if (unknownSince === undefined && row.health === "unverified")
    parts.push("not seen");
  if (parts.length === 0) return null;
  return (
    <span className="text-xs text-gray-500" data-testid="promise-health-detail">
      {parts.join(" · ")}
    </span>
  );
}

/** Retired: grey whatever telemetry says, and needs no read. */
export const GREY: HealthRow = {
  health: "grey",
  violations: null,
  lastSeen: null,
};
