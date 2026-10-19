import type { Tracer } from "@opentelemetry/api";
import { writeClauseSignals } from "../promises/clause-signal.js";
import type { BuildStep } from "./next-step.js";

/**
 * The signal for a-significant-concern-goes-to-the-person (audit-concerns-are-answered,
 * Build Phase 7): while an amendment waits for the person, the build's decision must be to
 * stop on it. Upheld when it stopped (`amendment`); broken when it started any other step
 * with an amendment waiting. Nothing is written when none waits.
 *
 * promise: an-audit-concern-gets-a-solution
 * clause: an-audit-concern-gets-a-solution/a-significant-concern-goes-to-the-person
 */

export async function markAmendmentStop(
	projectRoot: string,
	plan: string,
	amendments: readonly string[],
	decided: BuildStep["step"],
	tracer?: Tracer,
): Promise<void> {
	if (amendments.length === 0) return;
	const stopped = decided === "amendment";
	await writeClauseSignals(
		projectRoot,
		"build.amendment-stop",
		plan,
		{ plan: "audit-concerns-are-answered", phase: "Build Phase 7" },
		[
			{
				promise: "an-audit-concern-gets-a-solution",
				clause: "a-significant-concern-goes-to-the-person",
				...(stopped ? {} : { broken: `${plan} began ${decided} with ${amendments[0]} waiting` }),
			},
		],
		tracer,
	);
}
