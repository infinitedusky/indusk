import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkRetrospectiveReadiness } from "../cleanup/gate.js";
import { type ImplPhase, parseImplString } from "../impl-parser-core.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import type { TierConfig } from "./tiers.js";
import { phaseTier, readTierConfig, TierConfigError, tierForPhase } from "./tiers.js";

/**
 * The command that starts the plan's next piece of work, in a new session
 * (model-per-phase). A session that carries one plan's close into the next
 * compacts; the plan holds everything the next session needs, so each boundary
 * names the command to start it. Pure over the impl body.
 *
 * `missing` is the retrospective's readiness once every phase is closed (see
 * `checkRetrospectiveReadiness`); absent, a finished build is followed by
 * `/falsify`.
 */
export function nextSession(
	plan: string,
	implBody: string,
	opts: { missing?: string[]; config?: TierConfig } = {},
): string {
	const open = parseImplString(implBody).phases.find(isOpen);
	if (open) {
		const label = `${open.kind === "test" ? "Test" : "Build"} Phase ${open.number}`;
		const override = phaseTier(implBody, { kind: open.kind, number: open.number });
		let answer: ReturnType<typeof tierForPhase> = null;
		try {
			answer = opts.config ? tierForPhase(opts.config, "work", override) : null;
		} catch (err) {
			// a tier the config cannot honour does not stop a boundary from naming its command
			if (!(err instanceof TierConfigError)) throw err;
		}
		const on = answer ? `, on ${answer.tier} (${answer.model})` : "";
		return `In a new session, run: /work ${plan} — next is ${label}${on}`;
	}
	const missing = opts.missing ?? ["falsification"];
	if (missing.includes("falsification")) return `In a new session, run: /falsify ${plan}`;
	if (missing.includes("cleanup")) return `In a new session, run: /cleanup ${plan}`;
	return `In a new session, run: /retrospective ${plan}`;
}

function isOpen(phase: ImplPhase): boolean {
	return phase.gates.some((g) => g.items.some((i) => !i.checked));
}

/** `nextSession` for a plan on disk, read from its live copy. Falls back to `/work` when the impl cannot be read. */
export async function nextSessionForPlan(checkout: string, plan: string): Promise<string> {
	const live = await livePlanCopy(checkout, plan);
	const path = live.ok ? join(live.copy.dir, "impl.md") : null;
	if (!live.ok || path === null || !existsSync(path)) {
		return `In a new session, run: /work ${plan}`;
	}
	const content = readFileSync(path, "utf-8");
	let config: TierConfig | undefined;
	try {
		config = readTierConfig(checkout);
	} catch (err) {
		// an unreadable tier config does not stop a boundary from naming its command
		if (!(err instanceof TierConfigError)) throw err;
	}
	const { missing } = checkRetrospectiveReadiness(live.copy.dir, content);
	return nextSession(plan, content, { missing, config });
}
