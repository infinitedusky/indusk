/**
 * Pipeline definition — the ordered list of query steps.
 *
 * This is the single place to add, remove, or reorder queries.
 * The runner executes this list; it doesn't know about specific data sources.
 */

import { anchorLookup } from "./queries/anchor-lookup.js";
import { cgcRelationships } from "./queries/cgc-relationships.js";
import { evalFindings } from "./queries/eval-findings.js";
import { neighborFacts } from "./queries/neighbor-facts.js";
import { structuralNeighbors } from "./queries/structural-neighbors.js";
import { targetFacts } from "./queries/target-facts.js";
import type { QueryStep } from "./types.js";

/**
 * The beam pipeline. Each step is a discrete query.
 *
 * Execution groups (for parallelism):
 * - Group A (independent): anchor-lookup, target-facts, eval-findings
 * - Group B (depends on neighbors): structural-neighbors, then neighbor-facts, cgc-relationships
 */
export const BEAM_PIPELINE: QueryStep[] = [
	anchorLookup,
	structuralNeighbors,
	targetFacts,
	neighborFacts,
	evalFindings,
	cgcRelationships,
];
