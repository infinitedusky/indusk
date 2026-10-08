import { readConfig, writeConfig } from "../config.js";
import { type Connected, type ConnectInput, credentialEnvFor } from "./connect.js";
import type { FlyCli } from "./fly.js";
import { DEFAULT_REGION, publicAddresses, writeFlyConfig } from "./fly-config.js";
import { readFlyState } from "./fly-state.js";
import { planDeploy, type Step } from "./plan-deploy.js";
import { type LineWriter, redactingWriter } from "./redact.js";
import type { SecretsFile } from "./secrets-file.js";

/**
 * `indusk server deploy`: one command creates a project's recording server
 * in the person's own Fly account and connects the project to it
 * (server-provisioning ADR D1–D6).
 *
 * It reads what exists, plans the missing steps, runs them through the
 * person's `fly`, records which app is this project's server, and ends by
 * connecting — which reads the server back before naming it. Every line it
 * prints, Fly's output included, goes through a writer that knows the
 * password and the webhook.
 */
export const IMAGE = "ghcr.io/infinitedusky/indusk-always-on";
export const SERVER_USER = "indusk";

export interface DeployInput {
	projectRoot: string;
	projectName: string;
	app?: string;
	org?: string;
	region?: string;
	version: string;
	slackWebhook?: string | null;
	rotate?: boolean;
}

export interface DeployDeps {
	fly: FlyCli;
	connect(input: ConnectInput, out: LineWriter): Promise<Connected>;
	secrets: SecretsFile;
	/** Where every line goes, before redaction. */
	print(line: string): void;
	/** A new server password. */
	random(): string;
	/** A directory for the generated Fly config. */
	tempDir(): string;
}

export class DeployRefused extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DeployRefused";
	}
}

export function defaultAppName(projectName: string): string {
	const slug = projectName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `indusk-${slug || "project"}`;
}

export async function deploy(input: DeployInput, deps: DeployDeps): Promise<void> {
	const config = readConfig(input.projectRoot);
	if (!config) throw new DeployRefused(`no InDusk config at ${input.projectRoot} — run \`indusk init\` there first`);
	const recorded = config.server ?? null;
	const app = input.app ?? recorded?.app ?? defaultAppName(input.projectName);
	const region = input.region ?? recorded?.region ?? DEFAULT_REGION;
	const credentialEnv = credentialEnvFor(input.projectName);
	const stored = deps.secrets.get(credentialEnv);

	const state = await readFlyState(deps.fly, app);
	const plan = planDeploy(state, {
		app,
		org: input.org ?? recorded?.org ?? null,
		region,
		image: `${IMAGE}:${input.version}`,
		configPath: writeFlyConfig(deps.tempDir(), { app, region }),
		recordedApp: recorded?.app ?? null,
		haveCredential: Boolean(stored),
		rotate: Boolean(input.rotate),
	});
	if (plan.kind === "refuse") throw new DeployRefused(plan.message);

	const setsSecrets = plan.steps.some((s) => s.secrets);
	const password = setsSecrets ? deps.random() : null;
	const credential = password ? `${SERVER_USER}:${password}` : (stored as string);
	const webhook = input.slackWebhook ?? null;
	const out = redactingWriter(deps.print, [password ?? "", webhook ?? "", credential]);

	out.line(`Deploying ${IMAGE}:${input.version} as ${app} (${plan.org}, ${region}).`);
	for (const step of plan.steps) {
		await runStep(deps.fly, step, out, { password, webhook });
		if (step.name === "apps create") {
			writeConfig(input.projectRoot, {
				...(readConfig(input.projectRoot) ?? config),
				server: { provider: "fly", app, org: plan.org, region },
			});
		}
	}
	if (!readConfig(input.projectRoot)?.server) {
		writeConfig(input.projectRoot, {
			...(readConfig(input.projectRoot) ?? config),
			server: { provider: "fly", app, org: plan.org, region },
		});
	}
	if (setsSecrets && !webhook) {
		out.line("No Slack webhook given: announcements are off. The server records, and the admin shows what it records.");
	}

	const addresses = publicAddresses(app);
	try {
		await deps.connect({ projectRoot: input.projectRoot, projectName: input.projectName, ...addresses, credential }, out);
	} catch (err) {
		const why = err instanceof Error ? err.message : String(err);
		throw new DeployRefused(
			`${why}\nThe server ${app} exists and is recorded in this project's config; run \`indusk server deploy\` again to finish connecting.`,
		);
	}
}

async function runStep(
	fly: FlyCli,
	step: Step,
	out: LineWriter,
	secrets: { password: string | null; webhook: string | null },
): Promise<void> {
	const stdin = step.secrets
		? [
				`INDUSK_SERVER_PASSWORD=${secrets.password}`,
				...(secrets.webhook ? [`INDUSK_SERVER_SLACK_WEBHOOK=${secrets.webhook}`] : []),
			].join("\n")
		: undefined;
	out.line(`fly ${step.args.join(" ")}`);
	const r = await fly.run(step.args, stdin === undefined ? undefined : { stdin });
	for (const line of `${r.stdout}${r.stderr}`.split("\n")) if (line.trim()) out.line(`  ${line}`);
	if (r.status !== 0) {
		throw new DeployRefused(`\`fly ${step.name}\` failed (exit ${r.status}); nothing after it ran. Its output is above.`);
	}
}
