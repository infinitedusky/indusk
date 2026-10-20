import {
  planPromiseHealth,
  readHealth,
} from "@infinitedusky/indusk-mcp/promises/health";
import type { PromiseEntry } from "@infinitedusky/indusk-mcp/promises/registry";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";
import { standingKept } from "@/lib/standing-kept";

// promise: a-promise-reads-the-same-on-its-plan-page
/**
 * The promises the plans' own checkouts (their worktrees) register, read once
 * for a plan's page and for the nav's red dot, so both hand the package the
 * same promises; `planPromiseHealth` decides which of them the trunk answers.
 */
export function worktreePromises(
  projectPath: string,
  checkouts: string[],
): PromiseEntry[] {
  return checkouts
    .filter((c) => c !== projectPath)
    .flatMap((c) => registryOf(readProjectPromises(c))?.promises ?? []);
}

/**
 * Each promise's health for a plan's page, from the package's one answer for
 * the alarm source (`planPromiseHealth`, the same the sidebar's red dot reads)
 * and the cached read the layout makes, plus the promises `checkout` (the
 * plan's worktree) registers. Empty when the registry does not read: a chip
 * then keeps the colour of its registry state.
 */
export async function readPlanHealth(
  projectPath: string,
  checkout = projectPath,
) {
  const registry = registryOf(readProjectPromises(projectPath));
  if (!registry) return {};
  return planPromiseHealth(
    registry,
    await standingKept(`health:${projectPath}`, () =>
      readHealth(projectPath, registry),
    ),
    worktreePromises(projectPath, [checkout]),
  );
}
