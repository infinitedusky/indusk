import matter from "gray-matter";
import { type BuildPlan, nextBuildStep } from "../build/next-step.js";
import { BuildPlanUnreadable, readBuildPlan } from "../build/read-plan.js";
import type { RetrospectiveReadiness } from "../cleanup/gate.js";
import { parseImplString } from "../impl-parser-core.js";
import { parseTrajectory } from "../trajectory/parser.js";
import type { TierConfig } from "./tiers.js";
import { phaseTier, readTierConfig, TierConfigError, tierForPhase } from "./tiers.js";

/**
 * The command that starts the plan's next piece of work, in a new session
 * (model-per-phase). A session that carries one plan's close into the next
 * compacts; the plan holds everything the next session needs, so each boundary
 * names the command to start it.
 *
 * What comes next is the build's own decision (`nextBuildStep`), not a second
 * one: a phase with a blocker, a phase waiting on a person and a finished
 * build with rows still open are each named for what they are, and never
 * sent on as `/work` or `/retrospective`.
 *
 * `readiness` is the retrospective's readiness (see
 * `checkRetrospectiveReadiness`); absent, a finished build is followed by
 * `/falsify`.
 */
export function nextSession(
	plan: string,
	implBody: string,
	opts: {
		readiness?: Pick<RetrospectiveReadiness, "missing"> & { nonTerminalRows?: string[] };
		config?: TierConfig;
	} = {},
): string {
	const readiness = {
		missing: ["falsification"],
		nonTerminalRows: [],
		...opts.readiness,
	} as RetrospectiveReadiness;
	const buildPlan: BuildPlan = {
		impl: parseImplString(implBody),
		trajectory: parseTrajectory(matter(implBody).content),
		readiness,
	};
	const step = nextBuildStep(buildPlan);
	switch (step.step) {
		case "work":
			return `In a new session, run: /work ${plan} — next is ${step.phase.split(":")[0]}${modelOf(implBody, step.phase, opts.config)}`;
		case "falsify":
			return `In a new session, run: /falsify ${plan}`;
		case "cleanup":
			return `In a new session, run: /cleanup ${plan}`;
		case "review":
			return `In a new session, run: /retrospective ${plan}`;
		case "judgement":
			return `${step.phase.split(":")[0]} waits on a person before the build continues: ${step.item}`;
		case "cannot-continue":
			return `Cannot continue: ${step.why}`;
	}
}

/** `, on <tier> (<model>)` for the phase named by `Build Phase 2: Name`, or nothing. */
function modelOf(implBody: string, phase: string, config: TierConfig | undefined): string {
	const m = /^(Test|Build) Phase (\d+)/.exec(phase);
	if (!m || !config) return "";
	const ref = {
		kind: m[1] === "Test" ? ("test" as const) : ("build" as const),
		number: Number(m[2]),
	};
	try {
		const answer = tierForPhase(config, "work", phaseTier(implBody, ref));
		return answer ? `, on ${answer.tier} (${answer.model})` : "";
	} catch (err) {
		// a tier the config cannot honour does not stop a boundary from naming its command
		if (err instanceof TierConfigError) return "";
		throw err;
	}
}

/** `nextSession` for a plan on disk, read from its live copy. Falls back to `/work` when the plan cannot be read. */
export async function nextSessionForPlan(checkout: string, plan: string): Promise<string> {
	let built: Awaited<ReturnType<typeof readBuildPlan>>;
	try {
		built = await readBuildPlan(checkout, plan);
	} catch (err) {
		if (err instanceof BuildPlanUnreadable) return `In a new session, run: /work ${plan}`;
		throw err;
	}
	let config: TierConfig | undefined;
	try {
		config = readTierConfig(checkout);
	} catch (err) {
		// an unreadable tier config does not stop a boundary from naming its command
		if (!(err instanceof TierConfigError)) throw err;
	}
	return nextSession(plan, built.content, { readiness: built.readiness, config });
}
