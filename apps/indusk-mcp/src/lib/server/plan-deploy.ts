import type { FlyState } from "./fly-state.js";

/**
 * The steps `indusk server deploy` runs, decided from what exists on Fly and
 * what the project recorded (server-provisioning ADR D2, D4). Pure: every
 * refusal and every "already there" is a unit test over a state.
 *
 * Order matters and is the reference deployment's (day-always-on-deploy):
 * app, volume, secrets, deploy, then addresses — a first deploy has none, and
 * the query port is not 443, so it needs a dedicated IPv4.
 */
export interface DeployWanted {
	app: string;
	org: string | null;
	region: string;
	image: string;
	configPath: string;
	/** The app this project's config records as its server, if any. */
	recordedApp: string | null;
	/** Whether this machine holds the project's server credential. */
	haveCredential: boolean;
	rotate: boolean;
	/** A Slack webhook was given: it is set even on a server that exists (A23). */
	hasWebhook?: boolean;
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

export type DeployPlan =
	| { kind: "steps"; org: string; steps: Step[] }
	| { kind: "refuse"; message: string };

export const VOLUME_NAME = "indusk_telemetry";
export const VOLUME_GB = 3;

export function planDeploy(state: FlyState, wanted: DeployWanted): DeployPlan {
	const refuse = (message: string): DeployPlan => ({ kind: "refuse", message });

	if (state.cli === "missing") {
		return refuse(
			"The Fly CLI is not installed. Install it (https://fly.io/docs/flyctl/install/), run `fly auth login`, then run this again.",
		);
	}
	if (state.cli === "signed-out")
		return refuse("fly is not signed in. Run `fly auth login`, then run this again.");

	if (wanted.recordedApp && wanted.recordedApp !== wanted.app) {
		return refuse(
			`This project's server is ${wanted.recordedApp}, recorded in its config. Run without --app to update it; a second server for one project is not something this does.`,
		);
	}
	if (state.app.exists && wanted.recordedApp !== wanted.app) {
		return refuse(
			`A Fly app named ${wanted.app} already exists and is not recorded as this project's server. Choose another name with --app <name>.`,
		);
	}

	const org = state.app.exists && state.app.org ? state.app.org : wanted.org;
	if (!org) {
		if (state.orgs.length === 1) return withOrg(state, wanted, state.orgs[0] as string);
		return refuse(
			`Your Fly account has several organisations; name one with --org: ${state.orgs.join(", ")}.`,
		);
	}
	if (!state.app.exists && state.orgs.length > 0 && !state.orgs.includes(org)) {
		return refuse(`${org} is not one of your Fly organisations: ${state.orgs.join(", ")}.`);
	}
	return withOrg(state, wanted, org);
}

/** A new password is set for a new app, on `--rotate`, or when this machine lacks the project's credential. */
export function setsPassword(state: FlyState, wanted: DeployWanted): boolean {
	return !state.app.exists || wanted.rotate || !wanted.haveCredential;
}

function withOrg(state: FlyState, wanted: DeployWanted, org: string): DeployPlan {
	const a = wanted.app;
	const steps: Step[] = [];
	if (!state.app.exists)
		steps.push({ name: "apps create", args: ["apps", "create", a, "--org", org] });
	if (!state.app.volumes.includes(VOLUME_NAME)) {
		steps.push({
			name: "volumes create",
			args: [
				"volumes",
				"create",
				VOLUME_NAME,
				"--size",
				String(VOLUME_GB),
				"--region",
				wanted.region,
				"-a",
				a,
				"--yes",
			],
		});
	}
	if (setsPassword(state, wanted) || wanted.hasWebhook) {
		steps.push({
			name: "secrets import",
			args: ["secrets", "import", "-a", a, "--stage"],
			secrets: true,
		});
	}
	steps.push({
		name: "deploy",
		args: ["deploy", "-a", a, "-c", wanted.configPath, "--image", wanted.image, "--ha=false"],
	});
	if (!state.app.ips.includes("v6"))
		steps.push({ name: "ips allocate-v6", args: ["ips", "allocate-v6", "-a", a] });
	if (!state.app.ips.includes("v4")) {
		steps.push({ name: "ips allocate-v4", args: ["ips", "allocate-v4", "--yes", "-a", a] });
	}
	return { kind: "steps", org, steps };
}
