import type { FlyState } from "./fly-state.js";

/** The steps a deploy runs, decided from what exists. Built in Build Phase 2. */
export interface DeployWanted {
	app: string;
	org: string | null;
	region: string;
	image: string;
	configPath: string;
	recordedApp: string | null;
	haveCredential: boolean;
	rotate: boolean;
}

export type StepName =
	| "apps create"
	| "volumes create"
	| "secrets import"
	| "deploy"
	| "ips allocate-v6"
	| "ips allocate-v4";

export interface Step {
	name: StepName;
	args: string[];
	/** The secrets step takes its values on stdin, filled in by the caller. */
	secrets?: true;
}

export type DeployPlan = { kind: "steps"; org: string; steps: Step[] } | { kind: "refuse"; message: string };

export function planDeploy(_state: FlyState, _wanted: DeployWanted): DeployPlan {
	throw new Error("planDeploy: not built yet");
}
