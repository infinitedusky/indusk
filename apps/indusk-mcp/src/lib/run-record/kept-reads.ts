/**
 * A reading kept for a few seconds (admin-pages-load-fast, decisions 4, 5, 12, 16, 20a).
 *
 * A page asks for the machine's process list and a repository's landing history; each ask
 * costs a program start, so the answer is kept per key for a window, shared by every request
 * that arrives while it is being read, and never kept when it failed. The synchronous readers
 * (`psAll`, `landedAsker`) are for the command line; a reader a page calls goes through here.
 *
 * clause: admin-pages-load-fast/kept-briefly
 */

/** How long a reading is kept: longer than the admin's five-second live refresh, so the refresh reuses it. */
export const KEPT_FOR_MS = 8000;
/** The longest a reading is ever kept, whatever the refresh: a dead run must read stopped within this. */
export const KEPT_CEILING_MS = 15_000;

/**
 * The window for a project whose live refresh is `refreshMs`: 1.5 refreshes, never under
 * `KEPT_FOR_MS` and never over `KEPT_CEILING_MS`.
 */
export function keptWindow(refreshMs?: number): number {
	const wanted = refreshMs === undefined ? KEPT_FOR_MS : Math.max(KEPT_FOR_MS, 1.5 * refreshMs);
	return Math.min(KEPT_CEILING_MS, wanted);
}

export interface Kept<T> {
	value: T;
	/** How old the reading is: 0 when this call read it. */
	ageMs: number;
	/** True when this call started no read (an earlier or an in-flight one answered it). */
	reused: boolean;
	/** A fresh read was made although the previous one was still inside its window: the window is not holding. */
	refreshedEarly: boolean;
	/** When the value was read (ms, the clock given). */
	readAt: number;
	/** The window the reading was kept under. */
	windowMs: number;
}

interface Done {
	value: unknown;
	at: number;
	windowMs: number;
}
interface Entry {
	done?: Done;
	pending?: { token: object; promise: Promise<unknown> };
}

/** One map for the whole process: Next can load this module once per bundle (decision 16). */
const SLOT = Symbol.for("indusk.admin-pages-load-fast.kept-reads");
function store(): Map<string, Entry> {
	const g = globalThis as unknown as Record<symbol, Map<string, Entry> | undefined>;
	let map = g[SLOT];
	if (map === undefined) {
		map = new Map();
		g[SLOT] = map;
	}
	return map;
}

export interface KeptDeps {
	now?: () => number;
	/** The window; clamped to `KEPT_CEILING_MS`. */
	forMs?: number;
}

/**
 * The reading under `key`: reused inside its window, read again after it, shared while a read
 * is in flight, and cleared when the read throws (the next call tries again at once).
 */
export async function keptRead<T>(
	key: string,
	read: () => Promise<T>,
	deps: KeptDeps = {},
): Promise<Kept<T>> {
	const now = deps.now ?? Date.now;
	const callerWindow = Math.min(KEPT_CEILING_MS, deps.forMs ?? KEPT_FOR_MS);
	const map = store();
	const entry = map.get(key);
	const at = now();
	const done = entry?.done;
	if (done !== undefined) {
		const age = at - done.at;
		const window = Math.max(done.windowMs, callerWindow);
		if (age >= 0 && age < window)
			return {
				value: done.value as T,
				ageMs: age,
				reused: true,
				refreshedEarly: false,
				readAt: done.at,
				windowMs: done.windowMs,
			};
	}
	if (entry?.pending !== undefined) {
		const value = (await entry.pending.promise) as T;
		return {
			value,
			ageMs: 0,
			reused: true,
			refreshedEarly: false,
			readAt: now(),
			windowMs: callerWindow,
		};
	}
	// A clock that ran backwards, or a previous reading still inside its window, means this
	// fresh read is early: the window is not holding.
	const refreshedEarly = done !== undefined && (at - done.at < 0 || at - done.at < done.windowMs);
	const token = {};
	const promise = read();
	const next: Entry = { ...(done === undefined ? {} : { done }), pending: { token, promise } };
	map.set(key, next);
	try {
		const value = await promise;
		const readAt = now();
		// Stored only if nothing forgot this key meanwhile.
		if (map.get(key) === next)
			map.set(key, { done: { value, at: readAt, windowMs: callerWindow } });
		return { value, ageMs: 0, reused: false, refreshedEarly, readAt, windowMs: callerWindow };
	} catch (error) {
		// A failure is never kept: drop the in-flight mark, and any older reading with it.
		if (map.get(key) === next) map.delete(key);
		throw error;
	}
}

/** Drops a kept reading, and with a prefix every key under it, at a moment it is known to be stale. */
export function forgetKept(keyOrPrefix?: string): void {
	const map = store();
	if (keyOrPrefix === undefined) {
		map.clear();
		return;
	}
	for (const key of [...map.keys()]) if (key.startsWith(keyOrPrefix)) map.delete(key);
}

/** Clears every kept reading: tests, between cases. */
export function resetKept(): void {
	forgetKept();
}
