/**
 * The admin daemon's recording loops (incident-recording, ADR D2).
 *
 * One loop per registered project that names a production source, on that
 * project's refresh interval (`admin.refresh_ms`): each tick runs one pass of
 * the writer, so a production break is recorded, committed and put in the
 * inbox while the admin runs, with no page open and nothing typed. A project
 * with only a local source gets no loop — a local break is work in progress
 * (the-demo-break-is-caught-locally).
 *
 * The server's `startPass` shape: a pass slower than its interval is never
 * overlapped (the next tick is skipped while one runs), a pass that throws is
 * logged and the loop goes on, and the registered projects are re-read on a
 * slower cadence so a project added while the admin runs is picked up.
 *
 * The projects, their sources, the interval and the pass are inputs, so the
 * loop's rules are unit tests with faked time.
 *
 * promise: a-production-break-is-recorded-unasked
 */

export interface RecorderLoopOptions {
	/** The registered projects' roots. */
	projects: () => string[];
	/** Whether a project names a production source (`promises.jaeger`). */
	hasProduction: (root: string) => boolean;
	/** The project's refresh interval, ms. */
	intervalFor: (root: string) => number;
	/** One pass for one project. */
	record: (root: string) => Promise<unknown>;
	log?: (line: string) => void;
	/** How often the registered projects are re-read. */
	reconcileEveryMs?: number;
}

export interface RecorderLoops {
	stop(): void;
	/** The projects being recorded, in the order they were picked up. */
	watching(): string[];
}

const DEFAULT_RECONCILE_MS = 60_000;

export function startRecorderLoops(opts: RecorderLoopOptions): RecorderLoops {
	const log = opts.log ?? ((line: string) => console.error(line));
	const loops = new Map<string, NodeJS.Timeout>();
	const running = new Set<string>();

	const tick = async (root: string): Promise<void> => {
		if (running.has(root)) return;
		running.add(root);
		try {
			await opts.record(root);
		} catch (err) {
			log(`recorder: a pass for ${root} failed: ${(err as Error).message}`);
		} finally {
			running.delete(root);
		}
	};

	const reconcile = (): void => {
		let wanted: string[];
		try {
			wanted = opts.projects().filter((root) => {
				try {
					return opts.hasProduction(root);
				} catch {
					return false;
				}
			});
		} catch (err) {
			log(`recorder: the registered projects could not be read: ${(err as Error).message}`);
			return;
		}
		for (const root of wanted) {
			if (loops.has(root)) continue;
			loops.set(
				root,
				setInterval(() => void tick(root), opts.intervalFor(root)),
			);
		}
		for (const [root, timer] of loops) {
			if (wanted.includes(root)) continue;
			clearInterval(timer);
			loops.delete(root);
		}
	};

	reconcile();
	const reconciler = setInterval(reconcile, opts.reconcileEveryMs ?? DEFAULT_RECONCILE_MS);

	return {
		stop() {
			clearInterval(reconciler);
			for (const timer of loops.values()) clearInterval(timer);
			loops.clear();
		},
		watching: () => [...loops.keys()],
	};
}
