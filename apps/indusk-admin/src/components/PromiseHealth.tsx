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
  source,
  labelled = false,
}: {
  row: HealthRow;
  /** Set when Jaeger could not be read: when it last could, or null for never. */
  unknownSince?: string | null;
  /** Which source this chip is from (promise-sources, ADR D7). */
  source?: string;
  /** Show the source's name on the chip — when a promise has more than one. */
  labelled?: boolean;
}) {
  const chip = PROMISE_HEALTH_CHIP[row.health];
  const said =
    unknownSince !== undefined && row.health === "unverified"
      ? `health unknown since ${unknownSince ?? "this server started"}`
      : chip.aria;
  const aria = labelled && source ? `${source}: ${said}` : said;
  return (
    <span
      role="img"
      data-testid="promise-health"
      data-health={row.health}
      {...(source ? { "data-source": source } : {})}
      aria-label={aria}
      title={aria}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}
    >
      {labelled && source && (
        <span className="mr-1 font-normal opacity-70">{source}</span>
      )}
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
  source,
}: {
  row: HealthRow;
  unknownSince?: string | null;
  /** Set when a promise has more than one source: the line names its own. */
  source?: string;
}) {
  if (row.health === "grey") return null;
  const parts: string[] = source ? [source] : [];
  if (row.violations !== null && row.violations > 0) {
    parts.push(
      `${row.atLeast ? "at least " : ""}${row.violations} violation${row.violations === 1 ? "" : "s"}`,
    );
    // Where, when the span said: one server holds staging and production, and
    // a red row that cannot say which is a red row nobody can act on. A span
    // that carried none says so rather than letting the reader assume.
    parts.push(row.environment ?? "environment unknown");
  }
  if (row.lastSeen) parts.push(`last seen ${day(row.lastSeen)}`);
  // expect_every (watcher-heartbeat): a silence the promise said was too long.
  if (row.silence) parts.push(`needs attention — ${row.silence}`);
  else if (unknownSince === undefined && row.health === "unverified")
    parts.push("not seen");
  if (parts.length === (source ? 1 : 0)) return null;
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

/** One source's observed health, as the page read it. */
export interface SourceObserved {
  /** `local` or `production`. */
  name: string;
  rows: Record<string, HealthRow>;
  unknownSince?: string | null;
  /** The watcher answered and did not hear (watcher-heartbeat). */
  blind?: { where: string; intake: string };
}

/** One chip in a promise's state cell: a source, its row, and whether it could be read. */
export interface SourceChip {
  source: string;
  row: HealthRow;
  unknownSince?: string | null;
}

/**
 * A source that could not be read, said in its own banner (promise-sources,
 * ADR D7): blind, or unknown since its last good read. Nothing for a source
 * that answered.
 */
export function SourceBanner({ observed }: { observed: SourceObserved }) {
  if (observed.blind) {
    return (
      <p
        className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        data-testid="watcher-blind"
        data-source={observed.name}
      >
        Watcher blind — a probe sent to {observed.blind.intake} was not returned
        by {observed.blind.where}. Something answers there and is not receiving
        this project&apos;s telemetry; no promise is shown upheld.
      </p>
    );
  }
  if (observed.unknownSince === undefined) return null;
  return (
    <p
      className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
      data-testid="health-unknown"
      data-source={observed.name}
    >
      The {observed.name} Jaeger could not be read — health unknown since{" "}
      {observed.unknownSince ?? "this server started"}. No promise is shown
      upheld.
    </p>
  );
}
