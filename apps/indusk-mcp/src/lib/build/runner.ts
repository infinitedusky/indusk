import { type BuildPlan, type BuildStep, nextBuildStep, type StepOutcome } from "./next-step.js";

/**
 * An unattended build (admin-plan-authoring, ADR D4, D7). After every step
 * the runner reads the plan and asks `nextBuildStep` what to do; each step
 * is one fresh session. It stops at review, at a judgement the plan
 * declared, or when it cannot continue — and never starts the retrospective
 * on its own: that is the release, and the release begins with acceptance.
 *
 * Everything that touches the world is a dependency — reading the plan,
 * running a step's session, recording acceptance — so the decisions here are
 * tested with fakes and the real wiring lives in `build-session.ts`.
 *
 * promise: a-build-runs-to-review-unasked
 */

export type BuildStepName = "work" | "falsify" | "cleanup" | "audit" | "retrospective";

/** The steps the runner runs as a session; every other answer stops it. */
const SESSION_STEPS = ["work", "falsify", "cleanup", "audit"] as const;
type SessionStep = (typeof SESSION_STEPS)[number];

function isSessionStep(s: BuildStep): s is Extract<BuildStep, { step: SessionStep }> {
	return (SESSION_STEPS as readonly string[]).includes(s.step);
}

export interface RunnerDeps {
	read: () => Promise<BuildPlan>;
	/**
	 * Run one step's session to its end; `error` when it failed after its retries.
	 * A `work` step also gets the phase it works (as `nextBuildStep` words it), so the
	 * session can run on that phase's model.
	 */
	run: (step: BuildStepName, phase?: string) => Promise<{ error: string | null }>;
	accept: (by: "person" | "auto") => Promise<void>;
	onStep?: (update: RunnerUpdate) => void;
}

export type RunnerUpdate =
	| { kind: "step"; step: BuildStepName; detail?: string }
	| { kind: "stopped"; stop: RunnerStop };

export type RunnerStop =
	| Exclude<BuildStep, { step: SessionStep }>
	| { step: "released" }
	| { step: "release-failed"; why: string };

export async function runBuild(deps: RunnerDeps & { autoAccept: boolean }): Promise<RunnerStop> {
	let last: StepOutcome | undefined;
	let previous: StepOutcome | undefined;
	for (;;) {
		const before = await deps.read();
		const next = nextBuildStep(before, { last, previous });
		if (!isSessionStep(next)) {
			if (next.step === "review" && deps.autoAccept) {
				const release = await runRelease(deps, "auto");
				const stop: RunnerStop = release.released
					? { step: "released" }
					: { step: "release-failed", why: release.error ?? "unknown" };
				deps.onStep?.({ kind: "stopped", stop });
				return stop;
			}
			deps.onStep?.({ kind: "stopped", stop: next });
			return next;
		}
		deps.onStep?.({
			kind: "step",
			step: next.step,
			...("phase" in next ? { detail: next.phase } : {}),
		});
		const { error } = await deps.run(next.step, "phase" in next ? next.phase : undefined);
		const after = await deps.read();
		previous = last;
		last = { progressed: fingerprint(after) !== fingerprint(before), error };
	}
}

/** Acceptance, then the release workflow: one session running the retrospective, which lands the plan. */
export async function runRelease(
	deps: Pick<RunnerDeps, "run" | "accept" | "onStep">,
	by: "person" | "auto",
): Promise<{ released: boolean; error: string | null }> {
	await deps.accept(by);
	deps.onStep?.({ kind: "step", step: "retrospective" });
	const { error } = await deps.run("retrospective");
	return { released: error === null, error };
}

/** What changing counts as progress: an item checked or unchecked, a row's state, a phase added. */
function fingerprint(plan: BuildPlan): string {
	const items = plan.impl.phases.map((p) =>
		p.gates.map((g) => g.items.map((i) => (i.checked ? 1 : 0)).join("")).join("|"),
	);
	const rows = plan.trajectory.rows.map((r) => `${r.id}:${r.state}`);
	return JSON.stringify([items, rows, plan.readiness.missing]);
}
