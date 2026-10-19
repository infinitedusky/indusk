import type { PlanningDecision } from "../build/next-planning-step.js";
import type { BuildStep } from "../build/next-step.js";
import type { RunKind } from "./record.js";

export type Restart =
	| { run: "planning"; decision: PlanningDecision }
	| { run: "build"; step: BuildStep }
	| { run: "release" };

export interface RestartReads {
	implStatus: string | null;
	accepted: boolean;
	build: () => BuildStep;
	planning: () => PlanningDecision;
}

/** Not yet the rule: always the build's step. */
export function restartStep(_dead: RunKind, reads: RestartReads): Restart {
	return { run: "build", step: reads.build() };
}
