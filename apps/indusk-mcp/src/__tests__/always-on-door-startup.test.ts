import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { freeLoopbackPort } from "../lib/telemetry/query-door.js";
import { CLI_BIN, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * day-always-on-deploy — A13: a server whose public query port is taken
 * starts nothing (Build Phase 4, falsification).
 *
 * `serve()` spawned Jaeger and then bound the query door. With the door's port
 * already held, the process exited on `EADDRINUSE` and Jaeger kept running —
 * reproduced by hand, holding the OTLP port and badger's lock on the volume.
 * A supervisor that does not kill the process group then restarts into a held
 * port and a locked volume, every time.
 */

function canBind(port: number): Promise<boolean> {
	return new Promise((res) => {
		const srv = createServer();
		srv.once("error", () => res(false));
		srv.listen(port, "0.0.0.0", () => srv.close(() => res(true)));
	});
}

let volume = "";
let holder: Server | null = null;

afterEach(async () => {
	// A Jaeger left behind by a red run is this file's to remove, not the
	// leak guard's to find.
	if (volume) spawnSync("pkill", ["-f", join(volume, "jaeger-server.yaml")]);
	if (holder) await new Promise((r) => holder?.close(() => r(undefined)));
	holder = null;
	if (volume) rmSync(volume, { recursive: true, force: true });
	volume = "";
});

describe.skipIf(SHOULD_SKIP)("A13 — a taken public query port starts nothing", () => {
	it("exits naming the port, and no Jaeger is left holding the intake", async () => {
		volume = mkdtempSync(join(tmpdir(), "always-on-door-startup-"));
		const queryPort = await freeLoopbackPort();
		const otlpPort = await freeLoopbackPort();
		const grpcPort = await freeLoopbackPort();
		holder = createServer();
		await new Promise<void>((r) => holder?.listen(queryPort, "0.0.0.0", () => r()));

		const child = spawn("node", [CLI_BIN, "telemetry", "serve"], {
			env: {
				...process.env,
				INDUSK_SERVER_VOLUME: volume,
				INDUSK_SERVER_OTLP_PORT: String(otlpPort),
				INDUSK_SERVER_QUERY_PORT: String(queryPort),
				INDUSK_SERVER_GRPC_PORT: String(grpcPort),
				INDUSK_SERVER_USER: "indusk",
				INDUSK_SERVER_PASSWORD: "s3cret-for-tests",
				INDUSK_SERVER_SLACK_WEBHOOK: "http://127.0.0.1:1/never",
				INDUSK_SERVER_PASS_INTERVAL_MS: String(60 * 60 * 1000),
				INDUSK_SKIP_UPDATE_CHECK: "1",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (c: Buffer) => {
			output += c.toString();
		});
		child.stderr.on("data", (c: Buffer) => {
			output += c.toString();
		});
		const code = await new Promise<number | null>((r) => {
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				r(null);
			}, 20_000);
			child.once("exit", (c) => {
				clearTimeout(timer);
				r(c);
			});
		});

		expect(code, output).not.toBe(0);
		expect(code, "the server should exit, not keep running").not.toBeNull();
		expect(output).toContain("INDUSK_SERVER_QUERY_PORT");
		expect(output).toContain(String(queryPort));

		// Give a Jaeger that was started the time it takes to bind, then ask
		// whether the intake port is free: a held port is a leaked Jaeger.
		await new Promise((r) => setTimeout(r, 2_000));
		expect(await canBind(otlpPort), "a Jaeger was left holding the OTLP port").toBe(true);
	}, 40_000);
});
