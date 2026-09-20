import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { FixtureSpan } from "./local-jaeger.js";
import { otlpBody } from "./local-jaeger.js";

/**
 * The always-on server as a test starts it (day-always-on, Test Phase 1).
 *
 * `indusk telemetry serve` in the foreground, on free ports, with a volume
 * this helper owns and credentials it knows — the real binary in its server
 * configuration, because a stub of Jaeger's auth or storage would test our
 * guess at both. `restart()` stops and starts the same process against the
 * same volume, which is the only way to ask whether anything was kept.
 *
 * Spans go in over OTLP with `Authorization: Basic …`, the way an
 * application's OpenTelemetry exporter sends them; `query()` reads the same
 * API `markedSpans` reads, with the same header.
 *
 * Throws when the server does not answer — a helper that degrades lets a test
 * about persistence pass against a server that never started.
 */

const REPO_ROOT = resolve(__dirname, "../../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

export const SERVER_USER = "indusk";
export const SERVER_PASSWORD = "s3cret-for-tests";

export interface AlwaysOnServer {
	/** `http://127.0.0.1:<port>` — the OTLP receiver. */
	otlpUrl: string;
	/** `http://127.0.0.1:<port>` — the query API and the Jaeger UI. */
	queryUrl: string;
	/** The volume the server keeps its storage and its announced record on. */
	volume: string;
	/** `user:password`, as `promises.jaeger`'s credential environment variable holds it. */
	credential: string;
	/** Export spans; resolves once the server has them (or throws). */
	load: (spans: FixtureSpan[]) => Promise<string[]>;
	/** A query-API GET, with or without credentials. */
	query: (path: string, opts?: { authenticated?: boolean }) => Promise<Response>;
	/** Post OTLP directly, with or without credentials — for the rows about refusal. */
	postOtlp: (body: unknown, opts?: { authenticated?: boolean }) => Promise<Response>;
	/** Stop and start again against the same volume. */
	restart: () => Promise<void>;
	stop: () => Promise<void>;
}

function authHeader(): string {
	return `Basic ${Buffer.from(`${SERVER_USER}:${SERVER_PASSWORD}`).toString("base64")}`;
}

function freePort(): Promise<number> {
	return new Promise((res, rej) => {
		const srv = createServer();
		srv.once("error", rej);
		srv.listen(0, "127.0.0.1", () => {
			const addr = srv.address();
			if (typeof addr === "object" && addr !== null) srv.close(() => res(addr.port));
			else rej(new Error("no port"));
		});
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export interface StartOptions {
	/** Extra environment for the server process — a Slack webhook, an interval. */
	env?: NodeJS.ProcessEnv;
	/** Reuse an existing volume (the restart case). */
	volume?: string;
}

export async function startAlwaysOnServer(opts: StartOptions = {}): Promise<AlwaysOnServer> {
	if (!existsSync(CLI_BIN)) {
		throw new Error(`startAlwaysOnServer: the CLI is not built at ${CLI_BIN}`);
	}
	const volume = opts.volume ?? mkdtempSync(join(tmpdir(), "always-on-volume-"));
	const otlpPort = await freePort();
	const queryPort = await freePort();
	const otlpUrl = `http://127.0.0.1:${otlpPort}`;
	const queryUrl = `http://127.0.0.1:${queryPort}`;

	let child: ChildProcess | null = null;
	let output = "";

	const spawnServer = async (): Promise<void> => {
		output = "";
		child = spawn("node", [CLI_BIN, "telemetry", "serve"], {
			env: {
				...process.env,
				INDUSK_SERVER_VOLUME: volume,
				INDUSK_SERVER_OTLP_PORT: String(otlpPort),
				INDUSK_SERVER_QUERY_PORT: String(queryPort),
				INDUSK_SERVER_USER: SERVER_USER,
				INDUSK_SERVER_PASSWORD: SERVER_PASSWORD,
				INDUSK_SKIP_UPDATE_CHECK: "1",
				...opts.env,
			},
			stdio: ["ignore", "pipe", "pipe"],
		});
		child.stdout?.on("data", (c: Buffer) => {
			output += c.toString();
		});
		child.stderr?.on("data", (c: Buffer) => {
			output += c.toString();
		});
		const deadline = Date.now() + 30_000;
		for (;;) {
			const res = await fetch(`${queryUrl}/api/services`, {
				headers: { authorization: authHeader() },
			}).catch(() => null);
			if (res?.ok) return;
			if (child.exitCode !== null || Date.now() > deadline) {
				throw new Error(
					`startAlwaysOnServer: the server did not answer on ${queryUrl} (exit ${child.exitCode}):\n${output}`,
				);
			}
			await sleep(250);
		}
	};

	const stop = async (): Promise<void> => {
		if (!child || child.exitCode !== null) return;
		const ended = new Promise<void>((r) => child?.once("exit", () => r()));
		child.kill("SIGTERM");
		await Promise.race([ended, sleep(5_000).then(() => child?.kill("SIGKILL"))]);
		await sleep(500);
	};

	await spawnServer();

	const postOtlp = (body: unknown, o: { authenticated?: boolean } = {}) =>
		fetch(`${otlpUrl}/v1/traces`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(o.authenticated === false ? {} : { authorization: authHeader() }),
			},
			body: JSON.stringify(body),
		});

	const query = (path: string, o: { authenticated?: boolean } = {}) =>
		fetch(`${queryUrl}${path}`, {
			headers: o.authenticated === false ? {} : { authorization: authHeader() },
		});

	return {
		otlpUrl,
		queryUrl,
		volume,
		credential: `${SERVER_USER}:${SERVER_PASSWORD}`,
		postOtlp,
		query,
		async load(spans) {
			const { body, traceIds } = otlpBody(spans);
			const res = await postOtlp(body);
			if (!res.ok) {
				throw new Error(
					`startAlwaysOnServer.load: OTLP refused (${res.status}): ${await res.text()}`,
				);
			}
			const deadline = Date.now() + 20_000;
			for (const id of new Set(traceIds)) {
				for (;;) {
					const r = await query(`/api/traces/${id}`).catch(() => null);
					if (r?.ok) {
						const json = (await r.json()) as { data?: unknown[] };
						if (json.data && json.data.length > 0) break;
					}
					if (Date.now() > deadline) {
						throw new Error(`startAlwaysOnServer.load: trace ${id} never became queryable`);
					}
					await sleep(200);
				}
			}
			return traceIds;
		},
		async restart() {
			await stop();
			await spawnServer();
		},
		stop,
	};
}
