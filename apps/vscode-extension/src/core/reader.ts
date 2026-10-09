/**
 * The reader's lifecycle (vscode-extension ADR D3, risk "the child process
 * dies"): one long-lived `indusk promises health --json --every N`, its lines
 * handed on, restarted once, then reported. The process itself comes in
 * through `spawn`, so the rule is tested without one.
 */

export interface ReaderChild {
	onLine(cb: (text: string) => void): void;
	onStderr(cb: (text: string) => void): void;
	onExit(cb: (code: number | null) => void): void;
	onError(cb: (error: Error & { code?: string }) => void): void;
	kill(): void;
}

export interface ReaderOptions {
	command: string;
	everySeconds: number;
	spawn: (command: string, args: string[]) => ReaderChild;
	onLine: (text: string) => void;
	/** Said once, when the reader has stopped for good. */
	onStopped: (message: string) => void;
}

export function startReader(o: ReaderOptions): { stop(): void } {
	let child: ReaderChild | null = null;
	let restarts = 0;
	let stopping = false;
	const start = () => {
		child = o.spawn(o.command, ["promises", "health", "--json", "--every", String(o.everySeconds)]);
		child.onLine(o.onLine);
		child.onExit(() => {
			if (stopping) return;
			if (restarts++ < 1) start();
			else
				o.onStopped(
					`InDusk stopped reading promise health (\`${o.command} promises health\` exited). Reload the window to try again.`,
				);
		});
	};
	start();
	return {
		stop() {
			stopping = true;
			child?.kill();
		},
	};
}
