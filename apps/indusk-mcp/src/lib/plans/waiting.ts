import type { Question } from "../session/protocol.js";
import type { PlanSnapshot } from "./steps.js";

/**
 * What a plan waits on a person for (plan-cockpit, ADR decision 4). Stub —
 * Build Phase 6 implements it.
 *
 * promise: decisions-wait-in-one-place
 */

export type WaitingOn = "question" | "approval" | "review";

export interface WaitingSession {
	plan: string;
	kind: "planning" | "build";
	question: { requestId: string; questions: Question[] } | null;
}

export interface WaitingBuild {
	plan: string;
	stoppedAt: string | null;
}

export interface WaitingInput {
	sessions: ReadonlyArray<WaitingSession>;
	plans: ReadonlyArray<PlanSnapshot & { name: string }>;
	builds?: ReadonlyArray<WaitingBuild>;
}

export interface Waiting {
	plan: string;
	on: WaitingOn;
	step: string;
	decision: string;
	accept: string;
	alternative: string;
	requestId?: string;
}

export function planWaiting(_input: WaitingInput): Waiting[] {
	return [];
}
