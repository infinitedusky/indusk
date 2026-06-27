import { closeSync, openSync, rmSync, statSync, writeFileSync } from "node:fs";

/**
 * Minimal file lock for serializing read-modify-write on `.indusk/current.md`.
 *
 * Phase 6 falsification fix for T15: two CLI processes (or two MCP-tool callers)
 * with distinct session IDs can both read `current.md`, compute their respective
 * mutations from the same starting state, and then each rename over the other's
 * write — losing one section. The atomic rename only prevents torn-write
 * READS; it does not serialize the read-then-write pair.
 *
 * The lock pattern is the textbook `O_EXCL` approach: open the lockfile with
 * `wx` (exclusive create — fails with EEXIST if the file exists). On EEXIST,
 * retry with backoff until the timeout. On success, return a release function
 * that the caller invokes in a `finally` block.
 *
 * Stale lock recovery: if the existing lockfile is older than `staleAfterMs`
 * (default 30s), assume the holder crashed and silently take it over. This is
 * the standard "TTL on the lock" pattern — at the cost that a slow process
 * mid-write whose lock crosses the threshold gets clobbered by a newcomer.
 * Acceptable for the agent CLI use case: writes are sub-100ms in practice.
 */
export interface FileLockOptions {
	/** Total time to wait for the lock before throwing. */
	timeoutMs?: number;
	/** Polling interval while waiting for a held lock to release. */
	pollIntervalMs?: number;
	/** Stale-lock threshold: lockfiles older than this are taken over. */
	staleAfterMs?: number;
}

const DEFAULTS: Required<FileLockOptions> = {
	timeoutMs: 5000,
	pollIntervalMs: 25,
	staleAfterMs: 30_000,
};

function isEexistError(err: unknown): boolean {
	return Boolean(
		err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "EEXIST",
	);
}

function tryAcquire(lockPath: string): boolean {
	try {
		// O_EXCL — atomic create, fails if file exists.
		const fd = openSync(lockPath, "wx");
		writeFileSync(fd, `${process.pid}\n${Date.now()}\n`);
		closeSync(fd);
		return true;
	} catch (err) {
		if (isEexistError(err)) return false;
		throw err;
	}
}

function isStale(lockPath: string, staleAfterMs: number): boolean {
	try {
		const st = statSync(lockPath);
		return Date.now() - st.mtimeMs > staleAfterMs;
	} catch {
		// Lockfile vanished between checks — treat as not-stale (the holder released it).
		return false;
	}
}

function sleepSync(ms: number): void {
	const end = Date.now() + ms;
	// Synchronous spin — acceptable since lock waits are <100ms in practice and
	// the agent CLI is single-purpose. Async lock would require restructuring
	// every call site.
	const buf = new SharedArrayBuffer(4);
	const view = new Int32Array(buf);
	Atomics.wait(view, 0, 0, Math.max(1, end - Date.now()));
}

/**
 * Acquire an exclusive lock on `lockPath`. Blocks (synchronously) until the
 * lock is held or `timeoutMs` elapses. Returns a release function the caller
 * must invoke in a `finally` block.
 *
 * Throws on lockfile contention exceeding `timeoutMs`.
 */
export function acquireLock(lockPath: string, opts: FileLockOptions = {}): () => void {
	const { timeoutMs, pollIntervalMs, staleAfterMs } = { ...DEFAULTS, ...opts };
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (tryAcquire(lockPath)) {
			return () => {
				try {
					rmSync(lockPath, { force: true });
				} catch {
					// Best-effort release. If another process took our lock (because we
					// went stale), nothing to do.
				}
			};
		}
		if (isStale(lockPath, staleAfterMs)) {
			// Take it over.
			try {
				rmSync(lockPath, { force: true });
			} catch {
				// Race — someone else removed it first; fine.
			}
			continue;
		}
		sleepSync(pollIntervalMs);
	}

	throw new Error(`Timed out acquiring lock on ${lockPath} after ${timeoutMs}ms`);
}

/**
 * Convenience: run `fn` while holding the lock; release on return or throw.
 */
export function withLock<T>(lockPath: string, fn: () => T, opts?: FileLockOptions): T {
	const release = acquireLock(lockPath, opts);
	try {
		return fn();
	} finally {
		release();
	}
}
