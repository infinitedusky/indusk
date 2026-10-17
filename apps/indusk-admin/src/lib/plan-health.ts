import {
  planPromiseHealth,
  readHealth,
} from "@infinitedusky/indusk-mcp/promises/health";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";

/**
 * Each promise's health for a plan's page, from the package's one answer for
 * the alarm source (`planPromiseHealth`, the same the sidebar's red dot reads)
 * and the cached read the layout makes. Empty when the registry does not read:
 * a chip then keeps the colour of its registry state.
 */
export async function readPlanHealth(projectPath: string) {
  const registry = registryOf(readProjectPromises(projectPath));
  if (!registry) return {};
  return planPromiseHealth(registry, await readHealth(projectPath, registry));
}
