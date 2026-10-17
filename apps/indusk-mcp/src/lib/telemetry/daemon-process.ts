import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ProcessRow } from "./daemon-reads.js";

/**
 * What an InDusk daemon process is: one definition for status, the finding,
 * takeover, `stop`, `reap` and the test-daemon guard script.
 *
 * A process is InDusk's daemon of a home when it runs InDusk's shipped Jaeger
 * or collector binary with a `--config` file in that home. Never a port
 * answering, a start time, or the binary file existing: a port is slow under
 * load, and a process whose binary was replaced on disk is still the daemon.
 *
 * `apps/indusk-mcp/scripts/check-test-daemons.js` runs without a build and
 * carries a copy of `daemonProcessOf`; `telemetry-test-homes.test.ts` holds the
 * two equal.
 *
 * lesson: identify-a-process-by-what-it-cannot-rewrite
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export type DaemonRole = "jaeger" | "otelcol";

export interface DaemonProcess {
	role: DaemonRole;
	/** The binary path the process runs. */
	binary: string;
	/** The `--config=` value, with Jaeger's `file:` scheme stripped. */
	configPath: string;
	/** The directory the config sits in: the home that owns the process. */
	home: string;
}

/** The platform-split binaries this package ships. */
const BINARY = /(\S*telemetry-binaries-[a-z0-9-]+\/bin\/(jaeger|otelcol))\b/;
const CONFIG = /--config=(\S+)/;

/** The config file name each role is given inside a home. */
export function daemonConfigPath(home: string, role: DaemonRole): string {
	return join(home, role === "jaeger" ? "telemetry-jaeger.yaml" : "telemetry-collector.yaml");
}

/** The daemon process a command line is, or `null` when it is not one. */
export function daemonProcessOf(command: string): DaemonProcess | null {
	const binary = BINARY.exec(command);
	const config = CONFIG.exec(command);
	if (!binary || !config) return null;
	const configPath = config[1].replace(/^file:/, "");
	return {
		role: binary[2] as DaemonRole,
		binary: binary[1],
		configPath,
		home: dirname(configPath),
	};
}

/** The temporary directories a test's home lives under, as given and resolved. */
export function realTempRoots(): string[] {
	const resolve = (p: string): string | null => {
		try {
			return realpathSync(p);
		} catch {
			return null;
		}
	};
	const roots = ["/tmp", "/private/tmp", tmpdir(), resolve(tmpdir())];
	return [...new Set(roots.filter((r): r is string => r !== null))];
}

/** Whether a home is a test's (under a temporary root, by the path given or its real path) or the machine's. */
export function homeKind(home: string, tempRoots: readonly string[]): "real" | "temporary" {
	let resolved: string | null = null;
	try {
		resolved = realpathSync(home);
	} catch {
		// a home that is gone is judged by the path alone
	}
	const under = (path: string): boolean => tempRoots.some((root) => path.startsWith(`${root}/`));
	return under(home) || (resolved !== null && under(resolved)) ? "temporary" : "real";
}

/** A path as it really is on disk, or as given when it cannot be resolved. */
function realOrGiven(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/** Whether `p` runs out of this home: the same place on disk, however either is spelled (a link, `/private/var` for `/var`). */
export function isOwn(p: DaemonProcess, home: string): boolean {
	return p.home === home || realOrGiven(p.home) === realOrGiven(home);
}

/** Whether `p` runs out of a test's home. */
export function isTemporary(
	p: DaemonProcess,
	tempRoots: readonly string[] = realTempRoots(),
): boolean {
	return homeKind(p.home, tempRoots) === "temporary";
}

/** Whether `p`'s config file is gone: its home was deleted underneath it. */
export function isOrphan(p: DaemonProcess, exists: (path: string) => boolean): boolean {
	return !exists(p.configPath);
}

/** A daemon process of this home, as the process list and its sockets show it. */
export interface OwnProcess {
	pid: number;
	role: DaemonProcess["role"];
	binary: string;
	startedAt: string | null;
	ports: number[];
}

export function ownProcess(row: ProcessRow, proc: DaemonProcess, ports: number[]): OwnProcess {
	return { pid: row.pid, role: proc.role, binary: proc.binary, startedAt: row.startedAt, ports };
}
