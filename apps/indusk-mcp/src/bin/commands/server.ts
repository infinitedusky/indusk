import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { resolveProjectRoot } from "../../lib/config.js";
import { WatcherBlind } from "../../lib/promises/probe.js";
import { JaegerUnreachable } from "../../lib/promises/telemetry.js";
import { connect, probeServer } from "../../lib/server/connect.js";
import { DeployRefused, deploy } from "../../lib/server/deploy.js";
import { realFly } from "../../lib/server/fly.js";
import { DOCKERFILE_TEMPLATE } from "../../lib/server/fly-config.js";
import { FlyReadFailed } from "../../lib/server/fly-state.js";
import { redactingWriter } from "../../lib/server/redact.js";
import { secretsFile } from "../../lib/server/secrets-file.js";
import { induskHome } from "../../lib/telemetry/status.js";

/**
 * `indusk server`: give a project its recording server (server-provisioning).
 * `connect` points the project at one the person runs, anywhere.
 */
export interface ServerConnectOptions {
	queryUrl: string;
	intake: string;
	credentialEnv?: string;
	cwd?: string;
}

export async function serverConnect(opts: ServerConnectOptions): Promise<void> {
	const root = resolveProjectRoot(opts.cwd ?? process.cwd());
	if (!root) {
		console.error("No InDusk project here: run `indusk init` first, or run this inside one.");
		process.exitCode = 2;
		return;
	}
	const credential = opts.credentialEnv
		? process.env[opts.credentialEnv]?.trim()
		: await promptHidden("Server credential (user:password): ");
	if (!credential) {
		console.error(
			opts.credentialEnv
				? `${opts.credentialEnv} is not set — export it, or leave out --credential-env to be asked.`
				: "No credential given.",
		);
		process.exitCode = 2;
		return;
	}
	const out = redactingWriter((line) => console.info(line), [credential]);
	try {
		await connect(
			{
				projectRoot: root,
				projectName: basename(root),
				queryUrl: opts.queryUrl,
				otlpUrl: opts.intake,
				credential,
			},
			{
				probe: probeServer(basename(root)),
				secrets: secretsFile(join(induskHome(), "config.env")),
				out,
			},
		);
	} catch (err) {
		// Not heard, or not reached: either way the server was not read back, so
		// nothing was named (A15).
		if (err instanceof WatcherBlind || err instanceof JaegerUnreachable) {
			out.line(`${err.message}`);
			out.line("Nothing was written: the project still reads what it read before.");
			process.exitCode = 2;
			return;
		}
		out.line(err instanceof Error ? err.message : String(err));
		process.exitCode = 1;
	}
}

/** Ask for a value without echoing it; never an argument, which shell history and `ps` keep. */
function promptHidden(question: string): Promise<string> {
	return new Promise((resolve) => {
		let muted = false;
		const output = new Writable({
			write(chunk, _encoding, done) {
				if (!muted) process.stdout.write(chunk);
				done();
			},
		});
		const rl = createInterface({ input: process.stdin, output, terminal: true });
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write("\n");
			resolve(answer.trim());
		});
		muted = true;
	});
}

export interface ServerDeployOptions {
	app?: string;
	org?: string;
	region?: string;
	slackWebhookEnv?: string;
	version: string;
	rotate?: boolean;
	buildFrom?: string;
	cwd?: string;
}

/** `indusk server deploy`: the project's recording server in your own Fly account, connected. */
export async function serverDeploy(opts: ServerDeployOptions): Promise<void> {
	const root = resolveProjectRoot(opts.cwd ?? process.cwd());
	if (!root) {
		console.error("No InDusk project here: run `indusk init` first, or run this inside one.");
		process.exitCode = 2;
		return;
	}
	let slackWebhook: string | null = null;
	if (opts.slackWebhookEnv) {
		slackWebhook = process.env[opts.slackWebhookEnv]?.trim() || null;
		if (!slackWebhook) {
			console.error(
				`${opts.slackWebhookEnv} is not set — export it, or leave out --slack-webhook-env for no announcements.`,
			);
			process.exitCode = 2;
			return;
		}
	}
	const projectName = basename(root);
	const secrets = secretsFile(join(induskHome(), "config.env"));
	try {
		await deploy(
			{
				projectRoot: root,
				projectName,
				app: opts.app,
				org: opts.org,
				region: opts.region,
				version: opts.version,
				slackWebhook,
				rotate: opts.rotate,
				buildFrom: opts.buildFrom,
			},
			{
				fly: realFly(),
				secrets,
				print: (line) => console.info(line),
				random: () => randomBytes(24).toString("hex"),
				tempDir: () => mkdtempSync(join(tmpdir(), "indusk-fly-")),
				buildImage: buildServerImage,
				connect: (input, out) => connect(input, { probe: probeServer(projectName), secrets, out }),
			},
		);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exitCode = err instanceof DeployRefused || err instanceof FlyReadFailed ? 2 : 1;
	}
}

/** Build the server image from a packed tarball through the package's own template. */
async function buildServerImage(tarball: string, tag: string): Promise<void> {
	const ctx = mkdtempSync(join(tmpdir(), "indusk-image-"));
	copyFileSync(tarball, join(ctx, "indusk.tgz"));
	const r = spawnSync(
		"docker",
		// Fly runs amd64; a build on Apple Silicon is arm64 unless told (A8 found it).
		[
			"build",
			"--platform",
			"linux/amd64",
			"-f",
			DOCKERFILE_TEMPLATE,
			"--build-arg",
			"TARBALL=indusk.tgz",
			"-t",
			tag,
			ctx,
		],
		{ stdio: "inherit" },
	);
	if (r.status !== 0)
		throw new DeployRefused(
			`docker build of ${tag} failed (exit ${r.status}); nothing was deployed.`,
		);
	const login = spawnSync("fly", ["auth", "docker"], { stdio: "inherit" });
	if (login.status !== 0)
		throw new DeployRefused("`fly auth docker` failed; the image was built and not pushed.");
	const push = spawnSync("docker", ["push", tag], { stdio: "inherit" });
	if (push.status !== 0) {
		throw new DeployRefused(
			`docker push of ${tag} failed (exit ${push.status}); nothing was deployed.`,
		);
	}
}
