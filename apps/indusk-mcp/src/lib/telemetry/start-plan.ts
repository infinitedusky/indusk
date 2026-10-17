import {
	ADDRESS_ROLES,
	chooseAddress,
	describeHolder,
	type Holder,
	PORT_BLOCK,
	type PortHolder,
	type Ports,
	portsOf,
	portsOfRecord,
	ROLE_LABEL,
	type StoredAddress,
} from "./daemon-address.js";
import { daemonProcessOf, homeKind, realTempRoots } from "./daemon-process.js";
import type { DaemonReads } from "./daemon-reads.js";
import {
	type Candidate,
	candidatesOf,
	type DaemonState,
	daemonState,
	type Found,
	takeOverLocked,
} from "./daemon-state.js";
import type { DaemonMeta } from "./status.js";

/**
 * What a start does, decided from what is running, the stored address and what
 * holds its ports; and `ensureDaemon`, the one way anything starts the daemon.
 *
 * `startPlan` is pure: it reads nothing and opens no socket. `ensureDaemon`
 * reads the machine through `DaemonReads`, asks `startPlan`, and under the
 * home's lock reports, takes over, starts or refuses. In the real home the
 * daemon runs on the stored address (chosen here once, at first setup) and
 * never anywhere else; a temporary home takes the ports it is given and never
 * reads or writes an address.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type { Candidate };

export type StartState =
	| { kind: "running" }
	| { kind: "found"; candidates: Candidate[] }
	| { kind: "none" };

export type StartPlan =
	| { kind: "running" }
	| { kind: "takeover"; tracesPort?: number; strays: number[]; store?: StoredAddress }
	| { kind: "start"; ports: Ports; store?: StoredAddress }
	| { kind: "refuse"; holders: PortHolder[] }
	| { kind: "refuse-several"; listed: number[] }
	/** The stored address cannot be read: nothing is chosen, nothing moved. */
	| { kind: "refuse-address"; problem: string };

const pidsOf = (c: Candidate): number[] => [c.jaegerPid, c.otelcolPid];

export function startPlan(
	state: StartState,
	holders: Record<number, Holder | null>,
	home: string,
	opts: {
		address: StoredAddress | null;
		/** Why the address file cannot be read, when it is there and damaged. */
		unreadable?: string | null;
		given?: Partial<Ports>;
		spare?: number[];
	},
): StartPlan {
	if (state.kind === "running") return { kind: "running" };
	const real = homeKind(home, realTempRoots()) === "real";
	if (real && opts.unreadable) return { kind: "refuse-address", problem: opts.unreadable };
	const stored = real ? opts.address : null;

	if (state.kind === "found") {
		const { candidates } = state;
		const taken =
			candidates.length === 1
				? candidates[0]
				: stored === null
					? undefined
					: candidates.find((c) => c.tracesPort === stored.traces);
		if (taken === undefined) {
			return { kind: "refuse-several", listed: candidates.flatMap(pidsOf) };
		}
		const strays = candidates.filter((c) => c !== taken).flatMap(pidsOf);
		if (!real || stored !== null) return { kind: "takeover", tracesPort: taken.tracesPort, strays };
		const chosen = chooseAddress(holders, {}, home, opts.spare ?? []);
		return {
			kind: "takeover",
			tracesPort: taken.tracesPort,
			strays,
			...(chosen.kind === "chosen" ? { store: chosen.address } : {}),
		};
	}

	if (!real) {
		const given = opts.given ?? {};
		const ports = Object.fromEntries(
			ADDRESS_ROLES.map((role) => [role, given[role] ?? 0]),
		) as Ports;
		const conflicts = heldOf(ports, holders);
		return conflicts.length > 0 ? { kind: "refuse", holders: conflicts } : { kind: "start", ports };
	}
	if (stored !== null) {
		const ports = portsOf(stored);
		const conflicts = heldOf(ports, holders);
		return conflicts.length > 0 ? { kind: "refuse", holders: conflicts } : { kind: "start", ports };
	}
	const chosen = chooseAddress(holders, {}, home, opts.spare ?? []);
	if (chosen.kind === "refuse") return { kind: "refuse", holders: chosen.holders };
	return { kind: "start", ports: portsOf(chosen.address), store: chosen.address };
}

/** The ports (0 means any, never a conflict) that something already holds. */
function heldOf(ports: Ports, holders: Record<number, Holder | null>): PortHolder[] {
	return ADDRESS_ROLES.flatMap((role) => {
		const port = ports[role];
		const holder = port === 0 ? null : (holders[port] ?? null);
		return holder === null ? [] : [{ role, port, ...holder }];
	});
}

/** What a person reads for a start that could not go ahead, and what to do about it. */
export function refusalText(plan: StartPlan, home: string, address: StoredAddress | null): string {
	if (plan.kind === "refuse-several") {
		return [
			"Refusing to take over: several InDusk daemons run and none holds the stored traces port.",
			`  processes: ${plan.listed.join(", ")}`,
			"  Stop the ones you do not want (`kill <pid>`), then run `indusk telemetry start` again.",
		].join("\n");
	}
	if (plan.kind === "refuse-address") {
		return [
			`Refusing to start: ${plan.problem}.`,
			"  Nothing was chosen and the file was left as it was. `indusk telemetry address --reset` chooses the address again (every application given the old address then needs the new one).",
		].join("\n");
	}
	if (plan.kind !== "refuse") return "";
	const lines = ["Refusing to start: a port of the daemon is held by something else."];
	for (const holder of plan.holders) lines.push(`  ${describeHolder(holder)}`);
	if (plan.holders.some((h) => daemonProcessOf(h.command) !== null)) {
		lines.push(
			"  An InDusk daemon that is not this home's: `indusk telemetry reap` stops an orphan.",
		);
	}
	if (homeKind(home, realTempRoots()) === "real" && address !== null) {
		lines.push(
			"  The stored address was left as it was. Free the port, or choose the address again with `indusk telemetry address --reset` (every application given the old address then needs the new one).",
		);
	}
	return lines.join("\n");
}

export interface DaemonStartOptions {
	otlpPort?: number;
	uiPort?: number;
	logsPort?: number;
	mcpPort?: number;
}

const OPTION_FLAGS: [keyof DaemonStartOptions, keyof Ports, string][] = [
	["otlpPort", "traces", "--otlp-port"],
	["logsPort", "logs", "--logs-port"],
	["uiPort", "ui", "--ui-port"],
	["mcpPort", "mcp", "--mcp-port"],
];

/** The start options that give exactly these ports: the inverse of `startOptions`, for a restart that keeps a temporary home's ports. */
export function optionsOf(ports: Partial<Ports>): DaemonStartOptions {
	const options: DaemonStartOptions = {};
	for (const [key, role] of OPTION_FLAGS) {
		const port = ports[role];
		if (port !== undefined) options[key] = port;
	}
	return options;
}

/** The ports a start was given. Accepted only in a temporary home: the real home's daemon runs on its stored address. */
export function startOptions(opts: DaemonStartOptions, home: string): Partial<Ports> {
	const given: Partial<Ports> = {};
	for (const [key, role, flag] of OPTION_FLAGS) {
		const value = opts[key];
		if (value === undefined) continue;
		if (homeKind(home, realTempRoots()) === "real") {
			throw new Error(
				`${flag} is accepted only in a temporary home (a test's); the real home's daemon runs on its stored address — \`indusk telemetry address\` prints it.`,
			);
		}
		given[role] = value;
	}
	return given;
}

export type SpawnDaemon = (request: { ports: Ports }) => Promise<DaemonMeta>;

export type EnsureResult =
	| { kind: "running"; meta: DaemonMeta }
	| { kind: "took-over"; meta: DaemonMeta; found: Found; strays: number[]; stored?: StoredAddress }
	| { kind: "started"; meta: DaemonMeta; stored?: StoredAddress }
	| { kind: "refused"; text: string; holders: PortHolder[] };

/**
 * What a start sees of the machine: a daemon that runs, pairs found with no
 * record to name them, or nothing it can take over (a found process with no
 * partner is nothing to take over: its ports show as held instead).
 */
export function startStateOf(state: DaemonState, candidates: Candidate[]): StartState {
	if (state.kind === "running") return { kind: "running" };
	return candidates.length > 0 ? { kind: "found", candidates } : { kind: "none" };
}

/** The ports whose holders a start needs to know. */
function portsToCheck(
	real: boolean,
	address: StoredAddress | null,
	given: Partial<Ports>,
): number[] {
	if (!real) return Object.values(given).filter((p) => p > 0);
	return ADDRESS_ROLES.map((role) => (address === null ? PORT_BLOCK[role] : address[role]));
}

/**
 * The one way anything starts the daemon: `start`, `restart`, `register` (so
 * `init`, `update` and enabling the extension) and `demo`. Under the home's
 * lock it reports a daemon that runs, takes over one whose record is lost,
 * starts one on the stored address (choosing it first when none is stored), or
 * refuses naming the holder of a port. It never starts a second daemon and
 * never moves a stored port.
 */
export async function ensureDaemon(
	_by: string,
	reads: DaemonReads,
	home: string,
	spawn: SpawnDaemon,
	opts: { given?: Partial<Ports>; spare?: number[] } = {},
): Promise<EnsureResult> {
	const real = homeKind(home, realTempRoots()) === "real";
	const given = opts.given ?? {};
	const release = await reads.lock();
	try {
		const state = daemonState(reads, home);
		const startState = startStateOf(state, state.kind === "found" ? candidatesOf(reads, home) : []);
		const address = real ? reads.address() : null;
		const holders =
			startState.kind === "running" ? {} : reads.holders(portsToCheck(real, address, given));
		const unreadable = real ? reads.addressProblem() : null;
		const plan = startPlan(startState, holders, home, {
			address,
			unreadable,
			given,
			spare: opts.spare,
		});
		switch (plan.kind) {
			case "running":
				return { kind: "running", meta: state.meta as DaemonMeta };
			case "refuse":
				return { kind: "refused", text: refusalText(plan, home, address), holders: plan.holders };
			case "refuse-several":
			case "refuse-address":
				return { kind: "refused", text: refusalText(plan, home, address), holders: [] };
			case "takeover": {
				if (plan.store) reads.writeAddress(plan.store, { exclusive: true });
				const found = takeOverLocked(reads, home, { tracesPort: plan.tracesPort });
				if (found === null) {
					return {
						kind: "refused",
						text: "The daemon found was gone before it could be taken over.",
						holders: [],
					};
				}
				return {
					kind: "took-over",
					meta: found.meta,
					found,
					strays: plan.strays,
					stored: plan.store,
				};
			}
			case "start": {
				if (plan.store) reads.writeAddress(plan.store, { exclusive: true });
				const meta = await spawn({ ports: plan.ports });
				reads.writeRecord(meta, { exclusive: false });
				return { kind: "started", meta, stored: plan.store };
			}
		}
	} finally {
		release();
	}
}

function portLine(label: string, port: number): string {
	return `  ${`${label}:`.padEnd(11)}${port > 0 ? `http://localhost:${port}` : "unknown (not read from a socket)"}`;
}

/** The ports and processes of a running daemon, one line each. */
export function describeDaemon(meta: DaemonMeta): string {
	return portLines(meta).join("\n");
}

function portLines(meta: DaemonMeta): string[] {
	return [
		portLine("OTLP", meta.otlpPort),
		portLine("Logs", meta.logsOtlpPort),
		portLine("Jaeger UI", meta.uiPort),
		portLine("Jaeger MCP", meta.mcpPort),
		`  PIDs:      jaeger=${meta.jaegerPid} otelcol=${meta.otelcolPid}`,
	];
}

/** What `start` prints and exits with for an outcome. */
export function startReport(result: EnsureResult): { code: number; text: string } {
	switch (result.kind) {
		case "refused":
			return { code: 1, text: result.text };
		case "running":
			return {
				code: 0,
				text: ["Telemetry daemon is already running:", ...portLines(result.meta)].join("\n"),
			};
		case "took-over": {
			const { meta, strays } = result;
			const ports = [meta.otlpPort, meta.logsOtlpPort, meta.uiPort, meta.mcpPort]
				.map((p) => (p > 0 ? String(p) : "unknown"))
				.join(", ");
			const lines = [
				`Telemetry daemon: took over the running daemon: jaeger ${meta.jaegerPid}, otelcol ${meta.otelcolPid} on ${ports}`,
				...portLines(meta),
			];
			if (result.stored) lines.push(...pickedLines(result.stored));
			if (strays.length > 0) {
				lines.push(
					`  strays the record does not name: ${strays.join(", ")}; \`indusk telemetry reap\` stops them`,
				);
			}
			return { code: 0, text: lines.join("\n") };
		}
		case "started": {
			const lines = ["Telemetry daemon started:", ...portLines(result.meta)];
			lines.push(`  Logs file: ${result.meta.logsPath}`);
			if (result.stored) lines.push(...pickedLines(result.stored));
			return { code: 0, text: lines.join("\n") };
		}
	}
}

/** Lines naming each block port that was held at first setup, who held it and the port picked instead. */
function pickedLines(address: StoredAddress): string[] {
	return address.picked.map(
		(p) =>
			`  ${ROLE_LABEL[p.role]} port ${p.blockPort} was held${p.holder ? ` by ${p.holder}` : ""}; picked ${address[p.role]} instead, once, and stored it`,
	);
}

/** The ports a restart brings the daemon up on: the stored address in the real home, the running daemon's own in a temporary one. */
export function restartPorts(state: DaemonState, home: string): Ports | null {
	if (homeKind(home, realTempRoots()) === "real") {
		return state.address === null ? null : portsOf(state.address);
	}
	const meta = state.meta;
	if (meta === null) return null;
	const ports = portsOfRecord(meta);
	return ADDRESS_ROLES.every((role) => ports[role] > 0) ? ports : null;
}
