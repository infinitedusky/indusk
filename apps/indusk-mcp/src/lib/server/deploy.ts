import { type InduskConfig, readConfig, writeConfig } from "../config.js";
import { WatcherBlind } from "../promises/probe.js";
import { JaegerUnreachable } from "../promises/telemetry.js";
import { type Connected, type ConnectInput, credentialEnvFor } from "./connect.js";
import type { FlyCli } from "./fly.js";
import { DEFAULT_REGION, publicAddresses, writeFlyConfig } from "./fly-config.js";
import { readFlyState } from "./fly-state.js";
import { type DeployWanted, planDeploy, type Step, setsPassword } from "./plan-deploy.js";
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
 *
 * promise: a-fly-deploy-is-one-command
 * promise: the-recording-server-runs-from-a-published-image
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
	/**
	 * A packed tarball to build the image from on this machine, for a version no
	 * release has published yet (the live check, a server change under test).
	 * Without it, deploy pulls the published image and never builds (A20).
	 */
	buildFrom?: string;
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
	/**
	 * A suffix that makes each `--build-from` tag new: Fly's registry outlives
	 * a destroyed app, and a reused tag deployed the previous build (A8).
	 */
	stamp?(): string;
	/** Build the server image from a tarball through the package's template, tagged `tag`, and push it to the app's Fly registry. */
	buildImage?(tarball: string, tag: string): Promise<void>;
	/** The wait between read-back attempts while a new server comes up. */
	sleep?(ms: number): Promise<void>;
	now?(): number;
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
	if (!config)
		throw new DeployRefused(
			`no InDusk config at ${input.projectRoot} — run \`indusk init\` there first`,
		);
	const recorded = config.server ?? null;
	const app = input.app ?? recorded?.app ?? defaultAppName(input.projectName);
	const region = input.region ?? recorded?.region ?? DEFAULT_REGION;
	// The variable the project's config already names, when it names one — a
	// project connected before keeps reading it — else this project's own.
	const credentialEnv =
		config.promises?.jaeger?.credential_env ??
		credentialEnvFor(input.projectRoot, input.projectName);
	const stored = deps.secrets.get(credentialEnv);

	const state = await readFlyState(deps.fly, app);
	// An unreleased build goes to the app's own Fly registry, never the public
	// one, so Fly's CLI need not find this machine's Docker daemon (A8 found that
	// `--local-only` could not see OrbStack's).
	const image = input.buildFrom
		? `registry.fly.io/${app}:${input.version}-local-${deps.stamp?.() ?? Date.now().toString(36)}`
		: `${IMAGE}:${input.version}`;
	const plan = planDeploy(state, {
		app,
		org: input.org ?? recorded?.org ?? null,
		region,
		image,
		configPath: writeFlyConfig(deps.tempDir(), { app, region }),
		recordedApp: recorded?.app ?? null,
		haveCredential: Boolean(stored),
		rotate: Boolean(input.rotate),
		hasWebhook: Boolean(input.slackWebhook),
	});
	if (plan.kind === "refuse") throw new DeployRefused(plan.message);

	const newPassword = setsPassword(state, {
		haveCredential: Boolean(stored),
		rotate: Boolean(input.rotate),
	} as DeployWanted);
	const password = newPassword ? deps.random() : null;
	const credential = password ? `${SERVER_USER}:${password}` : (stored as string);
	const webhook = input.slackWebhook ?? null;
	const out = redactingWriter(deps.print, [password ?? "", webhook ?? "", credential]);

	out.line(`Deploying ${image} as ${app} (${plan.org}, ${region}).`);
	const server = { provider: "fly" as const, app, org: plan.org, region };
	for (const step of plan.steps) {
		if (step.name === "deploy" && input.buildFrom) {
			// The app exists by now, so its registry does.
			if (!deps.buildImage)
				throw new DeployRefused("this deploy cannot build an image: no builder was given");
			out.line(
				`Building ${image} from ${input.buildFrom} and pushing it to the app's Fly registry …`,
			);
			await deps.buildImage(input.buildFrom, image);
		}
		await runStep(deps.fly, step, out, { password, webhook });
		// Recorded as soon as the app exists, so a failure in any later step
		// still leaves a second run its identity (A17).
		if (step.name === "apps create") recordServer(input.projectRoot, server);
	}
	recordServer(input.projectRoot, server);
	if (newPassword && !webhook) {
		out.line(
			"No Slack webhook given: announcements are off. The server records, and the admin shows what it records.",
		);
	}

	const addresses = publicAddresses(app);
	try {
		await connectWhenReachable(
			() =>
				deps.connect(
					{
						projectRoot: input.projectRoot,
						projectName: input.projectName,
						...addresses,
						credential,
					},
					out,
				),
			deps,
			out,
		);
	} catch (err) {
		const why = err instanceof Error ? err.message : String(err);
		// Connecting with a credential stored before this run, and refused: a
		// second run would use the same one. Only a new password gets past it.
		const next =
			password === null
				? `connected with the credential this machine stored before (${credentialEnv}), and the server did not accept it; run \`indusk server deploy --rotate\` to set a new password`
				: "run `indusk server deploy` again to finish connecting";
		throw new DeployRefused(
			`${why}\nThe server ${app} exists and is recorded in this project's config; ${next}.`,
		);
	}
}

/** How long a new server may take to become reachable: its addresses and certificate. */
export const REACHABLE_WITHIN_MS = 5 * 60_000;
const REACHABLE_POLL_MS = 10_000;

/**
 * Connect, waiting while the server cannot be reached at all. A Fly app's
 * address and certificate come up a minute or so after the deploy ends (A8
 * found the first read-back failing, and the server answering a minute
 * later, and its two ports come up apart). `connect` on its own still reports
 * either at once.
 */
async function connectWhenReachable(
	attempt: () => Promise<Connected>,
	deps: Pick<DeployDeps, "sleep" | "now">,
	out: LineWriter,
): Promise<Connected> {
	const now = deps.now ?? Date.now;
	const until = now() + REACHABLE_WITHIN_MS;
	let said = false;
	for (;;) {
		try {
			return await attempt();
		} catch (err) {
			// For a server this command just created, not reached and not heard
			// both mean "not up yet": its two ports come up at different times (A8
			// saw the query port answer while the intake did not).
			// A login the server refused is not "not up yet": it is up, and the
			// credential is wrong. Waiting on it only delays saying so (A24).
			const refusedLogin = err instanceof Error && /answered 40[13]\b/.test(err.message);
			const notUpYet =
				!refusedLogin && (err instanceof JaegerUnreachable || err instanceof WatcherBlind);
			if (!notUpYet || now() >= until) throw err;
			if (!said) {
				out.line(
					"The server is not reachable yet — a new app's address and certificate take a minute or two. Waiting …",
				);
				said = true;
			}
			await (deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))))(
				REACHABLE_POLL_MS,
			);
		}
	}
}

/** Name this project's server in its config; the rest of the config is kept. */
function recordServer(projectRoot: string, server: NonNullable<InduskConfig["server"]>): void {
	const config = readConfig(projectRoot);
	if (config) writeConfig(projectRoot, { ...config, server });
}

async function runStep(
	fly: FlyCli,
	step: Step,
	out: LineWriter,
	secrets: { password: string | null; webhook: string | null },
): Promise<void> {
	const stdin = step.secrets
		? [
				// Only what changes: a webhook added to an existing server keeps its password (A23).
				...(secrets.password ? [`INDUSK_SERVER_PASSWORD=${secrets.password}`] : []),
				...(secrets.webhook ? [`INDUSK_SERVER_SLACK_WEBHOOK=${secrets.webhook}`] : []),
			].join("\n")
		: undefined;
	out.line(`fly ${step.args.join(" ")}`);
	const r = await fly.run(step.args, stdin === undefined ? undefined : { stdin });
	for (const line of `${r.stdout}${r.stderr}`.split("\n")) if (line.trim()) out.line(`  ${line}`);
	if (r.status !== 0) {
		throw new DeployRefused(
			`\`fly ${step.name}\` failed (exit ${r.status}); nothing after it ran. Its output is above.`,
		);
	}
}
