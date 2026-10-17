// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// promise: the-daemon-readers-follow-is-the-one-running
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	addressReport,
	chooseAddress,
	daemonAddress,
	PORT_BLOCK,
	portDifferences,
	portsOfRecord,
	resetAddress,
	type StoredAddress,
} from "../lib/telemetry/daemon-address.js";
import { collectorCmd, fakeReads, HOME, jaegerCmd, rec } from "./helpers/daemon-reads.js";

/**
 * A29 and A30 — the stored address is read by everything that needs the
 * daemon's ports and changes only on purpose.
 */

const SRC = resolve(__dirname, "..");
const PICKED_LOGS: StoredAddress = {
	...PORT_BLOCK,
	logs: 51234,
	picked: [{ role: "logs", blockPort: 24319 }],
};

function listSources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === "__tests__" ? [] : listSources(path);
		return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
	});
}

describe("A29 — the stored address is how anything learns the daemon's ports", () => {
	it("telemetry address prints the stored address, --json for init", () => {
		const reads = fakeReads({ address: PICKED_LOGS });
		expect(daemonAddress(reads)).toEqual({
			traces: "http://localhost:24318",
			logs: "http://localhost:51234",
			ui: "http://localhost:24316",
			mcp: "http://localhost:24317/mcp",
		});
		const out = addressReport(reads, { json: true });
		expect(out.code).toBe(0);
		expect(JSON.parse(out.text)).toEqual(daemonAddress(reads));
		expect(addressReport(reads, {}).text).toMatch(/24318.*51234.*24316.*24317/s);
	});

	it("with none stored it says so, exits non-zero and chooses nothing", () => {
		const reads = fakeReads({ address: null });
		const out = addressReport(reads, {});
		expect(out.code).not.toBe(0);
		expect(out.text).toMatch(/no address stored/);
		expect(reads.addressWrites).toEqual([]);
		expect(daemonAddress(reads)).toBeNull();
	});

	it("a block port free or held by this home's own daemon is kept", () => {
		const own = { pid: 7, command: jaegerCmd(7, HOME).command };
		const chosen = chooseAddress({ 24318: own, 24319: null }, {}, HOME, []);
		expect(chosen).toEqual({ kind: "chosen", address: { ...PORT_BLOCK, picked: [] } });
	});

	it("a block port held by a stranger is replaced by a free port, once, and the holder is recorded", () => {
		const stranger = { pid: 99, command: "/usr/bin/otelcol-contrib --config x.yaml" };
		const chosen = chooseAddress({ 24319: stranger }, {}, HOME, [51234]);
		expect(chosen).toEqual({
			kind: "chosen",
			address: {
				...PORT_BLOCK,
				logs: 51234,
				picked: [
					{ role: "logs", blockPort: 24319, holder: "99 /usr/bin/otelcol-contrib --config x.yaml" },
				],
			},
		});
	});

	it("a block port held by another home's InDusk daemon is refused, never taken", () => {
		const other = { pid: 8, command: jaegerCmd(8, "/home/other/.indusk").command };
		const chosen = chooseAddress({ 24318: other }, {}, HOME, [51234]);
		expect(chosen).toMatchObject({
			kind: "refuse",
			holders: [{ role: "traces", port: 24318, pid: 8 }],
		});
	});

	// A reader names no daemon port: it asks the stored address or the record.
	const READER_MODULES = [
		"lib/telemetry/status.ts",
		"lib/telemetry/start-plan.ts",
		"lib/telemetry/register.ts",
		"lib/promises/sources.ts",
		"lib/promises/telemetry.ts",
		"lib/promises/look-standing.ts",
		"lib/eval/otel.ts",
		"lib/mcp-config.ts",
		"bin/commands/demo.ts",
		"bin/commands/update.ts",
		"bin/commands/telemetry.ts",
	];
	it.each(READER_MODULES)("%s names no daemon port number in its code", (file) => {
		expect(readFileSync(join(SRC, file), "utf-8")).not.toMatch(
			/\b(4318|4319|16686|16687|2431[6-9])\b/,
		);
	});
});

describe("A30 — the address changes only on purpose", () => {
	const old: StoredAddress = {
		...PORT_BLOCK,
		traces: 51000,
		picked: [{ role: "traces", blockPort: 24318, holder: "9 otelcol-contrib" }],
	};

	it("--reset re-chooses by the same rule, keeps the running daemon's ports, and says so", () => {
		const reads = fakeReads({ address: old, holders: {} });
		const r = resetAddress(reads, HOME);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.old?.traces).toBe(51000);
		expect(r.new).toMatchObject({ traces: 24318, mcp: 24317 });
		expect(r.message).toMatch(/every application given the old address/);
		expect(reads.address()).toEqual(r.new);
	});

	it("a block port still held by a stranger keeps the port this home's running daemon holds", () => {
		const reads = fakeReads({
			address: old,
			record: rec(1, 2, { otlpPort: 51000 }),
			processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)],
			holders: { 24318: { pid: 99, command: "/usr/bin/otelcol-contrib" } },
		});
		const r = resetAddress(reads, HOME);
		expect(r.ok && r.new.traces).toBe(51000);
	});

	it("a refusal (another home's daemon on a block port) changes nothing", () => {
		const reads = fakeReads({
			address: old,
			holders: { 24316: { pid: 8, command: jaegerCmd(8, "/home/other/.indusk").command } },
		});
		const r = resetAddress(reads, HOME);
		expect(r.ok).toBe(false);
		expect(reads.addressWrites).toEqual([]);
		expect(reads.address()).toEqual(old);
	});

	it("nothing else writes the stored address", () => {
		const writers = listSources(SRC)
			.filter((f) => /\.writeAddress\(/.test(readFileSync(f, "utf-8")))
			.map((f) => relative(SRC, f))
			.sort();
		expect(writers).toEqual(["lib/telemetry/daemon-address.ts", "lib/telemetry/start-plan.ts"]);
	});
});

describe("A35 — one definition reads a record's ports, one compares them with the address", () => {
	it("reads the record's four ports by role", () => {
		const meta = rec(1, 2, { otlpPort: 1, logsOtlpPort: 2, uiPort: 3, mcpPort: 4 });
		expect(portsOfRecord(meta)).toEqual({ traces: 1, logs: 2, ui: 3, mcp: 4 });
	});

	it("a record on the stored address has no differences", () => {
		expect(portDifferences(rec(1, 2), PORT_BLOCK)).toEqual([]);
	});

	it("a record on another port names the role, the port held and the port expected", () => {
		expect(portDifferences(rec(1, 2, { otlpPort: 4318, mcpPort: 62843 }), PORT_BLOCK)).toEqual([
			{ role: "traces", held: 4318, expected: 24318 },
			{ role: "mcp", held: 62843, expected: 24317 },
		]);
	});

	it("a port the finder could not read (0) is no difference", () => {
		expect(portDifferences(rec(1, 2, { uiPort: 0 }), PORT_BLOCK)).toEqual([]);
	});

	it("with no stored address there is nothing to differ from", () => {
		expect(portDifferences(rec(1, 2, { otlpPort: 4318 }), null)).toEqual([]);
	});
});
