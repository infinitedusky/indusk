import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { daemonProcessOf, isOwn } from "./daemon-process.js";
import type { DaemonReads } from "./daemon-reads.js";
import type { DaemonMeta } from "./status.js";

/**
 * The local daemon's address: four ports, chosen once at first setup, kept in
 * `<home>/telemetry-address.json` and never moved.
 *
 * InDusk's own block holds the ports unless another program holds one at the
 * moment of choosing, when a free port is picked once for that role instead.
 * Nothing but first setup (`ensureDaemon`) and `telemetry address --reset`
 * writes the file; every reader and command learns the daemon's ports from it
 * (or from the record), and no other code names one.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type AddressRole = "traces" | "logs" | "ui" | "mcp";
export type Ports = Record<AddressRole, number>;

/** InDusk's own block: the only place these numbers appear. */
export const PORT_BLOCK: Ports = { traces: 24318, logs: 24319, ui: 24316, mcp: 24317 };

/** Jaeger's own default receiver and interface ports: where a daemon started before the stored address listens. */
export const JAEGER_DEFAULT_PORTS = { traces: 4318, ui: 16686 } as const;

export const ADDRESS_ROLES: readonly AddressRole[] = ["traces", "logs", "ui", "mcp"];

/** What each role is called to a person. */
export const ROLE_LABEL: Record<AddressRole, string> = {
	traces: "traces",
	logs: "logs",
	ui: "interface",
	mcp: "MCP",
};

export interface PickedPort {
	role: AddressRole;
	/** The block port that was held when the address was chosen. */
	blockPort: number;
	/** The process that held it, as `pid command`. */
	holder?: string;
}

export interface StoredAddress extends Ports {
	picked: PickedPort[];
}

export interface Holder {
	pid: number;
	command: string;
}

export interface PortHolder extends Holder {
	role: AddressRole;
	port: number;
}

export function addressFilePath(home: string): string {
	return join(home, "telemetry-address.json");
}

/** The stored ports of an address, without the record of what was picked. */
export function portsOf(address: Ports): Ports {
	return { traces: address.traces, logs: address.logs, ui: address.ui, mcp: address.mcp };
}

/** The four ports a record holds, by role. A port a finder could not read is 0. */
export function portsOfRecord(_meta: DaemonMeta): Ports {
	return { traces: 0, logs: 0, ui: 0, mcp: 0 };
}

/** A port a record holds that is not the stored address's. */
export interface PortDifference {
	role: AddressRole;
	held: number;
	expected: number;
}

/** Each port the record holds that is not the stored address's; a port read as 0 is no difference, no address gives none. */
export function portDifferences(_meta: DaemonMeta, _address: Ports | null): PortDifference[] {
	return [];
}

export type AddressRead =
	| { kind: "none" }
	| { kind: "stored"; address: StoredAddress }
	/** The file is there and cannot be read: a missing file and a damaged one are not the same. */
	| { kind: "unreadable"; problem: string };

/** What a home's address file holds: nothing, an address, or a file that is not one. */
export function readAddress(home: string): AddressRead {
	const path = addressFilePath(home);
	if (!existsSync(path)) return { kind: "none" };
	const unreadable = (why: string): AddressRead => ({
		kind: "unreadable",
		problem: `${path} exists but cannot be read (${why})`,
	});
	try {
		const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<StoredAddress>;
		const isPort = (n: unknown): boolean => Number.isInteger(n) && (n as number) > 0;
		const bad = ADDRESS_ROLES.filter((role) => !isPort(raw[role]));
		if (bad.length > 0) return unreadable(`no port for ${bad.join(", ")}`);
		return {
			kind: "stored",
			address: { ...portsOf(raw as Ports), picked: Array.isArray(raw.picked) ? raw.picked : [] },
		};
	} catch (err) {
		return unreadable(err instanceof Error ? err.message : "not JSON");
	}
}

/** The stored address of a home, or `null` when none is stored or the file is not one (`readAddress` tells which). */
export function readAddressFile(home: string): StoredAddress | null {
	const read = readAddress(home);
	return read.kind === "stored" ? read.address : null;
}

export type ChooseResult =
	| { kind: "chosen"; address: StoredAddress }
	| { kind: "refuse"; holders: PortHolder[] };

/**
 * Chooses the address by the one rule. A block port that is free, or held by
 * this home's own daemon, is kept. One held by a process that is not InDusk's
 * is replaced by the port this home's running daemon already holds for that
 * role, else the next of `spare` (free ports the caller picked), and the
 * holder is recorded. One held by another home's InDusk daemon refuses, as
 * does a stranger when no spare port is left.
 */
export function chooseAddress(
	holders: Record<number, Holder | null>,
	ownPorts: Partial<Ports>,
	home: string,
	spare: number[],
): ChooseResult {
	const free = [...spare];
	const ports: Partial<Ports> = {};
	const picked: PickedPort[] = [];
	const refused: PortHolder[] = [];
	for (const role of ADDRESS_ROLES) {
		const blockPort = PORT_BLOCK[role];
		const holder = holders[blockPort] ?? null;
		if (holder === null) {
			ports[role] = blockPort;
			continue;
		}
		const proc = daemonProcessOf(holder.command);
		if (proc !== null && isOwn(proc, home)) {
			ports[role] = blockPort;
			continue;
		}
		const replacement = proc === null ? (ownPorts[role] ?? free.shift()) : undefined;
		if (replacement === undefined) {
			refused.push({ role, port: blockPort, ...holder });
			continue;
		}
		ports[role] = replacement;
		picked.push({ role, blockPort, holder: `${holder.pid} ${holder.command}` });
	}
	if (refused.length > 0) return { kind: "refuse", holders: refused };
	return { kind: "chosen", address: { ...(ports as Ports), picked } };
}

export interface AddressUrls {
	traces: string;
	logs: string;
	ui: string;
	mcp: string;
}

/** The URLs of the stored address (traces, logs, interface, MCP), or `null` when none is stored. */
export function daemonAddress(from: DaemonReads | string): AddressUrls | null {
	const address = typeof from === "string" ? readAddressFile(from) : from.address();
	if (address === null) return null;
	return {
		traces: `http://localhost:${address.traces}`,
		logs: `http://localhost:${address.logs}`,
		ui: `http://localhost:${address.ui}`,
		mcp: `http://localhost:${address.mcp}/mcp`,
	};
}

/**
 * The MCP port a project's `jaeger` entry should name: the stored address's,
 * else the running daemon's record (a temporary home stores none), else none.
 */
export function mcpPortOf(reads: DaemonReads): number | null {
	const stored = reads.address();
	if (stored !== null) return stored.mcp;
	const recorded = reads.record()?.mcpPort ?? 0;
	return recorded > 0 ? recorded : null;
}

/** The sentence a person reads for a port held by a process: where, who, and what it runs. */
export function describeHolder(h: PortHolder): string {
	return `${ROLE_LABEL[h.role]} port ${h.port} is held by ${h.pid} (${h.command})`;
}

export type ResetResult =
	| { ok: true; old: StoredAddress | null; new: StoredAddress; message: string }
	| { ok: false; message: string };

/** The ports this home's running daemon holds, by role, read from its record. */
function runningDaemonPorts(reads: DaemonReads, home: string): Partial<Ports> {
	const meta = reads.record();
	if (meta === null) return {};
	const alive = reads.processes().some((row) => {
		const proc = daemonProcessOf(row.command);
		return proc !== null && isOwn(proc, home) && row.pid === meta.jaegerPid;
	});
	if (!alive) return {};
	const held: Partial<Ports> = {};
	for (const [role, port] of [
		["traces", meta.otlpPort],
		["logs", meta.logsOtlpPort],
		["ui", meta.uiPort],
		["mcp", meta.mcpPort],
	] as const) {
		if (port > 0) held[role] = port;
	}
	return held;
}

function lineOf(address: StoredAddress): string {
	return ADDRESS_ROLES.map((role) => `${ROLE_LABEL[role]} ${address[role]}`).join(", ");
}

/**
 * Chooses the address again by the same rule, keeping any port this home's
 * running daemon holds, and stores it. The only way the stored address ever
 * changes; `spare` is the free ports the caller picked for ports now held.
 */
export function resetAddress(reads: DaemonReads, home: string, spare: number[] = []): ResetResult {
	const release = reads.lockSync();
	try {
		const old = reads.address();
		const holders = reads.holders(ADDRESS_ROLES.map((role) => PORT_BLOCK[role]));
		const chosen = chooseAddress(holders, runningDaemonPorts(reads, home), home, spare);
		if (chosen.kind === "refuse") {
			return {
				ok: false,
				message: `Not changed: ${chosen.holders.map(describeHolder).join("; ")}. Another InDusk daemon holds a port of the block; stop it first.`,
			};
		}
		if (!reads.writeAddress(chosen.address, { exclusive: false })) {
			return { ok: false, message: "Not changed: the address could not be written." };
		}
		const message = [
			old === null ? "Address chosen." : `Old address: ${lineOf(old)}`,
			`New address: ${lineOf(chosen.address)}`,
			"Update every application given the old address (`indusk telemetry address --json` prints the new one); the running daemon moves onto it at `indusk telemetry restart`.",
		].join("\n");
		return { ok: true, old, new: chosen.address, message };
	} finally {
		release();
	}
}

/** What `indusk telemetry address [--json]` prints and exits with. It chooses nothing. */
export function addressReport(
	reads: DaemonReads,
	opts: { json?: boolean },
): { code: number; text: string } {
	const urls = daemonAddress(reads);
	const problem = reads.addressProblem();
	if (urls === null && problem !== null) {
		return {
			code: 1,
			text: `address unreadable: ${problem}; nothing was chosen. \`indusk telemetry address --reset\` chooses it again (every application given the old address then needs the new one)`,
		};
	}
	if (urls === null) {
		return {
			code: 1,
			text: "no address stored: the daemon has not been set up on this machine; `indusk telemetry start` chooses it once",
		};
	}
	if (opts.json) return { code: 0, text: JSON.stringify(urls) };
	const stored = reads.address() as StoredAddress;
	const lines = [
		"Telemetry daemon address:",
		`  traces:    ${urls.traces}`,
		`  logs:      ${urls.logs}`,
		`  interface: ${urls.ui}`,
		`  MCP:       ${urls.mcp}`,
	];
	for (const p of stored.picked) {
		lines.push(
			`  ${ROLE_LABEL[p.role]} was picked once: ${p.blockPort} was held${p.holder ? ` by ${p.holder}` : ""}`,
		);
	}
	return { code: 0, text: lines.join("\n") };
}
