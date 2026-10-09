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
	let stopped = false;
	let lastError = "";
	const stop = (message: string) => {
		if (stopped || stopping) return;
		stopped = true;
		o.onStopped(message);
	};
	const start = () => {
		lastError = "";
		const mine = o.spawn(o.command, [
			"promises",
			"health",
			"--json",
			"--every",
			String(o.everySeconds),
		]);
		child = mine;
		let ended = false;
		mine.onLine(o.onLine);
		mine.onStderr((text) => {
			const last = text
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.pop();
			if (last) lastError = last;
		});
		const onEnd = () => {
			if (ended || stopping || stopped) return;
			ended = true;
			if (restarts++ < 1) start();
			else
				stop(
					`InDusk stopped reading promise health: \`${o.command} promises health\` exited${
						lastError ? ` (${lastError})` : ""
					}. Reload the window to try again.`,
				);
		};
		mine.onExit(onEnd);
		mine.onError((error) => {
			if (error.code === "ENOENT") {
				ended = true;
				stop(
					`InDusk cannot read promise health: \`${o.command}\` was not found. Install InDusk, or name its command in the \`indusk.command\` setting.`,
				);
				return;
			}
			lastError = error.message;
			onEnd();
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
