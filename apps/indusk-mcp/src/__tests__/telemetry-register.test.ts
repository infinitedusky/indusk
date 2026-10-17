// clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
// promise: the-daemon-readers-follow-is-the-one-running
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PORT_BLOCK, type StoredAddress } from "../lib/telemetry/daemon-address.js";
import { registerWithDaemon } from "../lib/telemetry/register.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, ON_BLOCK, rec } from "./helpers/daemon-reads.js";

/**
 * A16 — registering a project (which `init`, `update` and enabling the
 * extension all run) takes over or starts the one daemon: never a second.
 * Driven over `DaemonReads` and a spawn spy, so no daemon starts.
 */

const STORED: StoredAddress = { ...PORT_BLOCK, picked: [] };
const OWN = [jaegerCmd(1, HOME), collectorCmd(2, HOME)];
let root: string;
let project: string;
let savedHome: string | undefined;
let savedSkip: string | undefined;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "register-"));
	project = join(root, "project");
	savedHome = process.env.INDUSK_HOME;
	savedSkip = process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART;
	process.env.INDUSK_HOME = join(root, "home");
	Reflect.deleteProperty(process.env, "INDUSK_SKIP_TELEMETRY_AUTOSTART");
	rmSync(project, { recursive: true, force: true });
	mkdirSync(project, { recursive: true });
});

afterEach(() => {
	if (savedHome === undefined) Reflect.deleteProperty(process.env, "INDUSK_HOME");
	else process.env.INDUSK_HOME = savedHome;
	if (savedSkip !== undefined) process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART = savedSkip;
	rmSync(root, { recursive: true, force: true });
});

describe("A16 — registering never starts a second daemon", () => {
	it.each(["init", "update", "extension enable"])(
		"%s with a daemon running registers against it and starts none",
		async () => {
			const spawn = vi.fn(async () => rec(901, 902));
			const r = await registerWithDaemon(project, {
				reads: fakeReads({ record: null, address: STORED, processes: OWN, listening: ON_BLOCK }),
				home: HOME,
				spawn,
			});
			expect(r.daemon).toBe("found");
			expect(r.code).toBe(0);
			expect(spawn).not.toHaveBeenCalled();
		},
	);

	it("no daemon and no address stored: exactly one start, on the address it chose", async () => {
		const spawn = vi.fn(async () => rec(901, 902));
		const reads = fakeReads({ record: null, address: null });
		const r = await registerWithDaemon(project, { reads, home: HOME, spawn });
		expect(r.daemon).toBe("started");
		expect(spawn).toHaveBeenCalledTimes(1);
		expect(spawn).toHaveBeenCalledWith({ ports: PORT_BLOCK });
		expect(reads.address()).toEqual(STORED);
	});

	it("a port held by a stranger refuses by name and still records the project", async () => {
		const spawn = vi.fn(async () => rec(901, 902));
		const reads = fakeReads({
			record: null,
			address: STORED,
			holders: { 24317: { pid: 4242, command: "/usr/bin/some-tool" } },
		});
		const r = await registerWithDaemon(project, { reads, home: HOME, spawn });
		expect(r.daemon).toBe("refused");
		expect(r.code).not.toBe(0);
		expect(r.lines.join("\n")).toMatch(/4242/);
		expect(spawn).not.toHaveBeenCalled();
		const { readRegistry } = await import("../lib/telemetry/registry.js");
		expect(readRegistry().projects.map((p) => p.path.split("/").pop())).toContain("project");
	});

	it("INDUSK_SKIP_TELEMETRY_AUTOSTART=1 still skips the start", async () => {
		process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART = "1";
		const spawn = vi.fn(async () => rec(901, 902));
		const r = await registerWithDaemon(project, {
			reads: fakeReads({ record: null, address: null }),
			home: HOME,
			spawn,
		});
		expect(r.daemon).toBe("skipped");
		expect(spawn).not.toHaveBeenCalled();
	});
});
