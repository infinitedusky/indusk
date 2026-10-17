import { join } from "node:path";
import type { DaemonReads } from "./daemon-reads.js";

/**
 * The local daemon's address: four ports, chosen once at first setup, kept in
 * `<home>/telemetry-address.json` and never moved.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type AddressRole = "traces" | "logs" | "ui" | "mcp";
export type Ports = Record<AddressRole, number>;

/** InDusk's own block: the only place these numbers appear. */
export const PORT_BLOCK: Ports = { traces: 24318, logs: 24319, ui: 24316, mcp: 24317 };

/** Jaeger's own default receiver and interface ports: where a daemon started before the stored address listens. */
export const JAEGER_DEFAULT_PORTS = { traces: 4318, ui: 16686 } as const;

export interface PickedPort {
	role: AddressRole;
	blockPort: number;
	/** The process that held the block port at first setup, as `pid command`. */
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

export function readAddressFile(_home: string): StoredAddress | null {
	return null;
}

export type ChooseResult =
	| { kind: "chosen"; address: StoredAddress }
	| { kind: "refuse"; holders: PortHolder[] };

export function chooseAddress(
	_holders: Record<number, Holder | null>,
	_ownPorts: Partial<Ports>,
	_home: string,
	_spare: number[],
): ChooseResult {
	return { kind: "refuse", holders: [] };
}

export interface AddressUrls {
	traces: string;
	logs: string;
	ui: string;
	mcp: string;
}

export function daemonAddress(_from: DaemonReads | string): AddressUrls | null {
	return null;
}

export type ResetResult =
	| { ok: true; old: StoredAddress | null; new: StoredAddress; message: string }
	| { ok: false; message: string };

export function resetAddress(_reads: DaemonReads, _home: string, _spare: number[] = []): ResetResult {
	return { ok: false, message: "" };
}

export function addressReport(
	_reads: DaemonReads,
	_opts: { json?: boolean },
): { code: number; text: string } {
	return { code: 0, text: "" };
}
