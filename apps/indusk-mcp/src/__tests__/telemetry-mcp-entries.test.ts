// clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
// promise: the-daemon-readers-follow-is-the-one-running
// promise: the-mcp-config-is-not-tracked
// promise: a-clone-without-an-mcp-config-gets-the-keep-list
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureMcpJson, upsertJaegerEntry } from "../lib/mcp-config.js";

/**
 * A27 (the cases of A17 join this file in Build Phase 3) — the project's
 * `.mcp.json` is the person's own file and is written only when it needs to
 * change:
 *
 *  1. a file that already names the stored MCP port is left alone, down to
 *     its modification time, so a start never makes the file look edited;
 *  2. a checkout with the telemetry extension enabled and no file gets the
 *     keep-list: `indusk` and `jaeger` at the stored MCP port;
 *  3. the file stays untracked: the repository's ignore rule still answers
 *     for it.
 *
 * Everything runs in temporary directories; no daemon is started and the real
 * InDusk home is never read (an `INDUSK_HOME` of its own holds the address).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const MCP_PORT = 24317;
const AN_OLD_TIME = new Date("2026-01-02T03:04:05Z");

let home: string;
let project: string;
let originalHome: string | undefined;

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "mcp-entries-home-"));
	project = mkdtempSync(join(tmpdir(), "mcp-entries-project-"));
	originalHome = process.env.INDUSK_HOME;
	process.env.INDUSK_HOME = home;
});

afterEach(() => {
	if (originalHome === undefined) Reflect.deleteProperty(process.env, "INDUSK_HOME");
	else process.env.INDUSK_HOME = originalHome;
	rmSync(home, { recursive: true, force: true });
	rmSync(project, { recursive: true, force: true });
});

describe("a project's .mcp.json is written only on a change", () => {
	it("leaves a file that already names the daemon alone, down to its mtime", () => {
		const file = join(project, ".mcp.json");
		writeFileSync(
			file,
			`${JSON.stringify({ mcpServers: { jaeger: { type: "http", url: `http://localhost:${MCP_PORT}/mcp` } } }, null, 2)}\n`,
		);
		utimesSync(file, AN_OLD_TIME, AN_OLD_TIME);
		const before = statSync(file).mtimeMs;

		upsertJaegerEntry(project, MCP_PORT);

		expect(statSync(file).mtimeMs, "the file was not rewritten").toBe(before);
	});

	it("gives a new checkout with the telemetry extension enabled the keep-list, jaeger at the stored MCP port", () => {
		writeFileSync(
			join(home, "telemetry-address.json"),
			JSON.stringify({ traces: 24318, logs: 24319, ui: 24316, mcp: MCP_PORT, picked: [] }),
		);
		const ext = join(project, ".indusk", "extensions", "local-telemetry");
		mkdirSync(ext, { recursive: true });
		copyFileSync(
			join(REPO_ROOT, "apps/indusk-mcp/extensions/local-telemetry/manifest.json"),
			join(ext, "manifest.json"),
		);

		expect(ensureMcpJson(project, { globalBinary: true })).toBe("created");

		const written = JSON.parse(readFileSync(join(project, ".mcp.json"), "utf-8")) as {
			mcpServers: Record<string, { type?: string; url?: string; command?: string }>;
		};
		expect(Object.keys(written.mcpServers).sort()).toEqual(["indusk", "jaeger"]);
		expect(written.mcpServers.jaeger).toEqual({
			type: "http",
			url: `http://localhost:${MCP_PORT}/mcp`,
		});
	});

	it("stays untracked: the repository's ignore rule still answers for .mcp.json", () => {
		const repo = mkdtempSync(join(tmpdir(), "mcp-entries-repo-"));
		try {
			spawnSync("git", ["init", "-q"], { cwd: repo });
			copyFileSync(join(REPO_ROOT, ".gitignore"), join(repo, ".gitignore"));
			writeFileSync(join(repo, ".mcp.json"), "{}\n");
			const ignored = spawnSync("git", ["check-ignore", "-q", ".mcp.json"], { cwd: repo });
			expect(ignored.status, "git check-ignore answers 0 for an ignored path").toBe(0);
		} finally {
			rmSync(repo, { recursive: true, force: true });
		}
	});
});
