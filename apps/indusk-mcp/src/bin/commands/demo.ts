import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { induskMcpPackageRoot } from "../../lib/package-root.js";
import { findFreePort } from "../../lib/telemetry/daemon.js";
import { liveOtlpEndpointSync } from "../../lib/telemetry/status.js";

/**
 * `indusk demo [dir]` (demo-app-template D6): copy the seat-holds example from
 * the installed package, make it an InDusk project, start the local telemetry
 * daemon and the example, and print where to look. Runs in the foreground
 * until Ctrl-C, which stops the example.
 *
 * promise: the-demo-app-starts-with-its-promise-holding
 */

export interface DemoOptions {
	open: boolean;
}

/** The example, from the published package or, in the InDusk repository, its source. */
export function exampleSource(packageRoot: string = induskMcpPackageRoot()): string {
	const shipped = join(packageRoot, "examples", "seat-holds");
	if (existsSync(shipped)) return shipped;
	return join(packageRoot, "..", "..", "examples", "seat-holds");
}

const LOCAL_STATE = /(^|\/)(node_modules|\.indusk\/eval|\.indusk\/agents)(\/|$)/;

function run(cmd: string, args: string[], cwd: string): void {
	const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
	if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}`);
}

export async function demo(dirArg: string | undefined, opts: DemoOptions): Promise<void> {
	const target = resolve(dirArg ?? "seat-holds");
	if (existsSync(target) && readdirSync(target).length > 0) {
		console.error(`Refusing: ${target} exists and is not empty. Name an empty or new folder.`);
		process.exit(1);
	}
	const source = exampleSource();
	if (!existsSync(source)) {
		console.error(`The seat-holds example is not in this install (looked in ${source}).`);
		process.exit(1);
	}

	console.info(`Copying the seat-holds example to ${target}`);
	cpSync(source, target, {
		recursive: true,
		filter: (src) => !LOCAL_STATE.test(src.slice(source.length)),
	});
	run("git", ["init", "-q"], target);

	console.info("Setting it up as an InDusk project");
	const { init } = await import("./init.js");
	await init(target, { noIndex: true });

	console.info("Installing its dependencies");
	run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], target);

	let otlp = liveOtlpEndpointSync();
	if (!otlp) {
		const { daemonStart } = await import("../../lib/telemetry/daemon.js");
		await daemonStart();
		otlp = liveOtlpEndpointSync();
	}
	if (!otlp) {
		console.error(
			"The local telemetry daemon did not start; run `indusk telemetry start` and try again.",
		);
		process.exit(1);
	}

	const port = await findFreePort(8080);
	const app = spawn("npm", ["start", "--silent"], {
		cwd: target,
		env: {
			...process.env,
			PORT: String(port),
			SEAT_HOLDS_FAULT_TOGGLE: "1",
			OTEL_EXPORTER_OTLP_ENDPOINT: otlp,
		},
		stdio: ["ignore", "pipe", "inherit"],
	});
	app.stdout?.on("data", (chunk: Buffer) => {
		const text = chunk.toString();
		process.stdout.write(text);
		const page = text.match(/Seat page:\s*(http\S+)/)?.[1];
		if (page) {
			console.info(
				[
					"",
					`Hold a seat at ${page}, then press Break it.`,
					`Watch the promise in the admin: \`indusk ui\`, project ${target.split("/").pop()}.`,
					`Or from here: \`indusk promises status\` in ${target}.`,
					"Ctrl-C stops the example.",
				].join("\n"),
			);
			if (opts.open) openInBrowser(page);
		}
	});
	const stop = () => app.kill("SIGINT");
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	await new Promise<void>((done) => app.once("close", () => done()));
}

function openInBrowser(url: string): void {
	const cmd =
		process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
	spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}
