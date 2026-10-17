// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
// promise: the-daemon-readers-follow-is-the-one-running
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A8 — a status read made by a process that is busy for longer than the port
 * check waits reports the daemon slow, never gone, and leaves its record.
 *
 * The daemon is real (the built CLI, a temporary INDUSK_HOME). The reader is
 * this process, kept busy: every socket the port check opens is followed by a
 * synchronous wait longer than the check's 500 ms, so the check's own timer
 * fires before the connection it already made is delivered. That is what a
 * loop held by other work (the admin rendering a page) does to a listening
 * port, and it is why `daemonStatus` once deleted a healthy daemon's record.
 * Wrapping `createConnection` makes both attempts of the check land in that
 * state every time; a single wait would let the retry's fresh socket through.
 *
 * System tier: it starts the real Jaeger and otelcol.
 */

const BUSY_MS = 700;

const busy = vi.hoisted(() => ({ on: false }));

vi.mock("node:net", async (importOriginal) => {
	const net = await importOriginal<typeof import("node:net")>();
	return {
		...net,
		createConnection: (...args: Parameters<typeof net.createConnection>) => {
			const socket = net.createConnection(...args);
			// The check arms its 500 ms timer last (`socket.setTimeout`); the reader
			// is busy from that moment, so the timer is due before the loop is back.
			const arm = socket.setTimeout.bind(socket);
			socket.setTimeout = ((ms: number, cb?: () => void) => {
				const armed = arm(ms, cb);
				if (busy.on) {
					const until = Date.now() + BUSY_MS;
					while (Date.now() < until) {
						// the reading process is busy with other work
					}
				}
				return armed;
			}) as typeof socket.setTimeout;
			return socket;
		},
	};
});

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let home: string;
/** Taken before the read: if the read deletes the record, `stop` cannot find the daemon. */
let daemonPids: number[] = [];
let originalHome: string | undefined;

function cli(args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: home },
		encoding: "utf-8",
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

beforeAll(() => {
	if (SHOULD_SKIP) return;
	home = mkdtempSync(join(tmpdir(), "slow-not-gone-"));
	originalHome = process.env.INDUSK_HOME;
	const start = cli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
	if (start.code !== 0)
		throw new Error(`the daemon did not start: ${start.stderr || start.stdout}`);
	const meta = JSON.parse(readFileSync(join(home, "telemetry.json"), "utf-8")) as {
		jaegerPid: number;
		otelcolPid: number;
	};
	daemonPids = [meta.jaegerPid, meta.otelcolPid];
}, 60_000);

afterAll(() => {
	busy.on = false;
	if (SHOULD_SKIP) return;
	cli(["telemetry", "stop"]);
	for (const pid of daemonPids) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// already gone
		}
	}
	process.env.INDUSK_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
}, 30_000);

describe("a busy reader reads the daemon as slow, not gone", () => {
	it.skipIf(SHOULD_SKIP)(
		`a status read made ${BUSY_MS} ms late on every port keeps the record and reports running`,
		async () => {
			process.env.INDUSK_HOME = home;
			const { daemonStatus } = await import("../lib/telemetry/status.js");

			busy.on = true;
			const result = await daemonStatus();
			busy.on = false;

			expect(existsSync(join(home, "telemetry.json")), "telemetry.json is still there").toBe(true);
			expect(existsSync(join(home, "telemetry.pid")), "telemetry.pid is still there").toBe(true);
			expect(result.running, "a slow port reads as running, not gone").toBe(true);
		},
		60_000,
	);
});
