// clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
// promise: the-daemon-readers-follow-is-the-one-running
// live check: runs only with INDUSK_LIVE_CHECK=daemon-found-not-guessed, against ~/.indusk, once
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A15 — on this machine, with the record moved aside, `start` takes the
 * running daemon over and then `status` finds it; one InDusk Jaeger and one
 * collector remain on the stored address; `promises status` shows the
 * promise broken naming a-read-never-loses-the-daemon; the interface shows
 * both upheld finding reports.
 *
 * It runs against the real InDusk home, once, and only when asked
 * (`INDUSK_LIVE_CHECK=daemon-found-not-guessed`): the release's system tier
 * must never move the real record. The record is copied to a temporary
 * directory first and put back in `finally`, whatever happens. No report
 * exists before Build Phase 5, so before then nothing is sent to the promise.
 */

const live = process.env.INDUSK_LIVE_CHECK === "daemon-found-not-guessed";
const REPO = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO, "apps/indusk-mcp/dist/bin/cli.js");
const REAL_HOME = join(homedir(), ".indusk");
const RECORD_FILES = ["telemetry.json", "telemetry.pid"];

function cli(args: string[], cwd = REPO): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		env: { ...process.env, INDUSK_HOME: REAL_HOME },
		encoding: "utf-8",
		timeout: 60_000,
	});
	return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Take the record out of the real home, keeping a copy that `restoreIfMissing` puts back. */
function recordAside(): { restoreIfMissing: () => void } {
	const backup = mkdtempSync(join(tmpdir(), "live-check-record-"));
	const saved = RECORD_FILES.map((name) => {
		const file = join(REAL_HOME, name);
		const text = existsSync(file) ? readFileSync(file, "utf-8") : null;
		if (text !== null) writeFileSync(join(backup, name), text);
		return { file, text };
	});
	for (const { file } of saved) rmSync(file, { force: true });
	return {
		restoreIfMissing() {
			for (const { file, text } of saved) {
				if (text !== null && !existsSync(file)) writeFileSync(file, text);
			}
			rmSync(backup, { recursive: true, force: true });
		},
	};
}

function ownDaemonProcesses(): { jaeger: number; otelcol: number } {
	const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf-8" });
	const own = ps.stdout
		.split("\n")
		.filter((l) => l.includes("telemetry-binaries") && l.includes(`${REAL_HOME}/telemetry-`));
	return {
		jaeger: own.filter((l) => /\/bin\/jaeger\b/.test(l)).length,
		otelcol: own.filter((l) => /\/bin\/otelcol\b/.test(l)).length,
	};
}

/** Upheld reports for a clause that reached the daemon's interface since `since` (ms). */
async function upheldReports(clause: string, since: number): Promise<number> {
	const meta = JSON.parse(readFileSync(join(REAL_HOME, "telemetry.json"), "utf-8")) as {
		uiPort: number;
	};
	const base = `http://localhost:${meta.uiPort}`;
	const services =
		((await (await fetch(`${base}/api/services`)).json()) as { data?: string[] }).data ?? [];
	let count = 0;
	for (const service of services) {
		const tags = encodeURIComponent(JSON.stringify({ "indusk.clause": clause }));
		const res = await fetch(
			`${base}/api/traces?service=${encodeURIComponent(service)}&tags=${tags}&lookback=1h&limit=200`,
		);
		const body = (await res.json()) as {
			data?: { spans: { startTime: number; tags: { key: string; value: unknown }[] }[] }[];
		};
		for (const trace of body.data ?? []) {
			for (const span of trace.spans) {
				const upheld = span.tags.some(
					(t) => t.key === "indusk.promise.outcome" && t.value === "upheld",
				);
				if (upheld && span.startTime / 1000 >= since) count++;
			}
		}
	}
	return count;
}

describe.runIf(live)("the daemon is found on this machine", () => {
	it("start takes over, status finds, one daemon stays on the stored address, the reports arrive", async () => {
		const sinceStart = Date.now();
		const aside = recordAside();
		let again: { restoreIfMissing: () => void } | undefined;
		try {
			expect(cli(["telemetry", "start"]).stdout).toMatch(/took over the running daemon/);
			again = recordAside();
			expect(cli(["telemetry", "status"]).stdout).toMatch(/running/);
			expect(existsSync(join(REAL_HOME, "telemetry.json"))).toBe(true);
			const address = JSON.parse(
				readFileSync(join(REAL_HOME, "telemetry-address.json"), "utf-8"),
			) as { traces: number; logs: number; ui: number; mcp: number };
			expect(ownDaemonProcesses()).toEqual({ jaeger: 1, otelcol: 1 });
			for (const port of [address.traces, address.logs, address.ui, address.mcp]) {
				const held = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
					encoding: "utf-8",
				});
				expect(held.stdout, `something listens on the stored port ${port}`).toMatch(/LISTEN/);
			}
			expect(cli(["promises", "status"], REPO).stdout).toMatch(
				/the-daemon-readers-follow-is-the-one-running .*broken.*a-read-never-loses-the-daemon/s,
			);
			expect(await upheldReports("a-lost-daemon-is-found", sinceStart)).toBeGreaterThanOrEqual(2);
		} finally {
			again?.restoreIfMissing();
			aside.restoreIfMissing();
		}
	}, 120_000);
});
