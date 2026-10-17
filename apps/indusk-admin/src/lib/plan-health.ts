import {
  planPromiseHealth,
  readHealth,
} from "@infinitedusky/indusk-mcp/promises/health";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";

/**
 * Each promise's health for a plan's page, from the package's one answer for
 * the alarm source (`planPromiseHealth`, the same the sidebar's red dot reads)
 * and the cached read the layout makes, plus the promises only `checkout`
 * (the plan's worktree) registers. Empty when the registry does not read:
 * a chip then keeps the colour of its registry state.
 */
export async function readPlanHealth(
  projectPath: string,
  checkout = projectPath,
) {
  const registry = registryOf(readProjectPromises(projectPath));
  if (!registry) return {};
  // A promise only the plan's own checkout registers has no entry in the
  // project's registry; it reads through the same rule rather than falling
  // back to its registry state's colour.
  const own =
    checkout === projectPath ? null : registryOf(readProjectPromises(checkout));
  const known = new Set(registry.promises.map((p) => p.name));
  const extra = own?.promises.filter((p) => !known.has(p.name)) ?? [];
  return planPromiseHealth(
    registry,
    await readHealth(projectPath, registry),
    extra,
  );
}
