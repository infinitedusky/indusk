import { AsyncLocalStorage } from "node:async_hooks";
import { execFile } from "node:child_process";

/**
 * The one way a page's reads start a program (admin-pages-load-fast, decisions 6 and 15):
 * asynchronous, so the server keeps answering while it runs; counted into the request's count
 * (`countStarts`), so a page whose starts grow with its plans is seen; and abandoned at the time
 * limit, the program killed, even if it never answers. The command line's synchronous starts
 * stay as they are.
 *
 * clause: admin-pages-load-fast/never-freezes
 */

/** A read that does not answer in this long is abandoned, and its program killed. */
export const READ_TIMEOUT_MS = 3000;

export interface ExecOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	maxBuffer?: number;
	timeout: number;
	killSignal: NodeJS.Signals;
	/** Written to the program's standard input, then closed. */
	input?: string;
}
/** Starts a program and gives its standard output; the input that lets a test hand in its own. */
export type Exec = (file: string, args: string[], options: ExecOptions) => Promise<string>;

const realExec: Exec = (file, args, options) =>
	new Promise((resolve, reject) => {
		const { input, ...rest } = options;
		const child = execFile(file, args, { ...rest, encoding: "utf-8" }, (error, stdout) =>
			error ? reject(error) : resolve(stdout),
		);
		child.stdin?.on("error", () => {
			// the program exited before reading its input: the exit status is the answer
		});
		child.stdin?.end(input);
	});

/** The starts a request has made; `countStarts` opens one around a page. */
const starts = new AsyncLocalStorage<{ count: number }>();

/** Runs `fn` and reports how many programs `startProgram` started inside it, awaited or not. */
export async function countStarts<T>(fn: () => Promise<T>): Promise<{ result: T; starts: number }> {
	const counter = { count: 0 };
	const result = await starts.run(counter, fn);
	return { result, starts: counter.count };
}

/**
 * Opens a count that lasts for the rest of the calling async chain: a page function calls it first,
 * so every `startProgram` below it, in any helper it awaits, adds to the page's count. `count()`
 * reads it. Used where wrapping the whole page in `countStarts` is not possible (a server component).
 */
export function beginStartCount(): { count(): number } {
	const counter = { count: 0 };
	starts.enterWith(counter);
	return { count: () => counter.count };
}

export interface StartOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	maxBuffer?: number;
	timeoutMs?: number;
	input?: string;
	exec?: Exec;
}

/**
 * The one way a page's reads start a program: asynchronous, counted into the request's count,
 * killed and rejected at the time limit even if the program never answers.
 */
export function startProgram(
	file: string,
	args: string[],
	options: StartOptions = {},
): Promise<string> {
	const store = starts.getStore();
	if (store) store.count += 1;
	const timeout = options.timeoutMs ?? READ_TIMEOUT_MS;
	const exec = options.exec ?? realExec;
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`${file} ${args[0] ?? ""} did not answer in ${timeout} ms`)),
			timeout,
		);
		timer.unref?.();
		exec(file, args, {
			...(options.cwd === undefined ? {} : { cwd: options.cwd }),
			...(options.env === undefined ? {} : { env: options.env }),
			...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }),
			...(options.input === undefined ? {} : { input: options.input }),
			timeout,
			killSignal: "SIGKILL",
		}).then(
			(out) => {
				clearTimeout(timer);
				resolve(out);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}
