import { existsSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "@infinitedusky/indusk-mcp/config";
import {
  type PhaseBoundaryRecord,
  readBoundaries,
} from "@infinitedusky/indusk-mcp/shape/boundary";

/**
 * Project-level reads — facts about a project that are not about any one
 * plan folder: its config, its eval directory, its phase-boundary record.
 * They lived in the plan-folder reader until the admin-ui-phase-progress
 * cleanup moved them here.
 *
 * Server-side only (filesystem access).
 */

/** The project's boundary records, read once per listing: the file is one per project. */
export type BoundaryRead =
  | { records: PhaseBoundaryRecord[] }
  | { error: string };

export async function readProjectBoundaries(
  projectRoot: string,
): Promise<BoundaryRead> {
  try {
    return { records: await readBoundaries(projectRoot) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export const DEFAULT_REFRESH_MS = 5000;
export const MIN_REFRESH_MS = 1000;

/**
 * The plan page's live-refresh interval, `admin.refresh_ms` in the project's
 * `.indusk/config.json` (admin-ui-phase-progress, Build Phase 5). Read
 * through the package's `readConfig` — the one parser of that file (A37) —
 * and absent, unreadable or out-of-range values fall back rather than
 * throw: a config typo must not take the page down, and the floor keeps a
 * stray `0` from hammering the daemon.
 */
export function readAdminRefreshMs(projectRoot: string): number {
  let value: unknown;
  try {
    value = readConfig(projectRoot)?.admin?.refresh_ms;
  } catch {
    return DEFAULT_REFRESH_MS;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_REFRESH_MS;
  }
  return Math.max(MIN_REFRESH_MS, Math.round(value));
}

/**
 * Whether the evaluator has ever written for this project: `.indusk/eval/` is
 * created by the first append (`EvalLogWriter.ensureDirectory`), so its
 * absence means "no evaluated commit yet", which the scorecards page says
 * instead of showing an empty list (admin-ui-phase-progress A24).
 */
export function hasEvalDirectory(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".indusk", "eval"));
}
