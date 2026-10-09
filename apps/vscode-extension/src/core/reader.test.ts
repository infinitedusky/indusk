import { describe, expect, it } from "vitest";
import { type ReaderChild, startReader } from "./reader.js";

/**
 * vscode-extension A19: a reader that cannot start, or keeps exiting, says
 * why — "not found" for a command that is not there, else its last error line.
 * The process is a fake; nothing is spawned.
 *
 * promise: a-break-reaches-the-editor
 */

function fakeChild() {
	const on: {
		line?: (t: string) => void;
		stderr?: (t: string) => void;
		exit?: (c: number | null) => void;
		error?: (e: Error & { code?: string }) => void;
	} = {};
	const child: ReaderChild = {
		onLine: (cb) => {
			on.line = cb;
		},
		onStderr: (cb) => {
			on.stderr = cb;
		},
		onExit: (cb) => {
			on.exit = cb;
		},
		onError: (cb) => {
			on.error = cb;
		},
		kill: () => {},
	};
	return { child, on };
}

function run() {
	const children: ReturnType<typeof fakeChild>[] = [];
	const said: string[] = [];
	const reader = startReader({
		command: "indusk",
		everySeconds: 5,
		spawn: () => {
			const c = fakeChild();
			children.push(c);
			return c.child;
		},
		onLine: () => {},
		onStopped: (m) => said.push(m),
	});
	return { children, said, reader };
}

describe("reader", () => {
	it("A19 — a command that is not found is said, once, as not found", () => {
		const { children, said } = run();
		const notFound = Object.assign(new Error("spawn indusk ENOENT"), { code: "ENOENT" });
		children[0]?.on.error?.(notFound);
		children[1]?.on.error?.(notFound);
		expect(said).toHaveLength(1);
		expect(said[0]).toMatch(/not found/);
		expect(said[0]).toMatch(/indusk\.command/);
	});

	it("A19 — a reader that keeps exiting is said with its last error line", () => {
		const { children, said } = run();
		children[0]?.on.stderr?.("error: unknown command 'health'\n");
		children[0]?.on.exit?.(1);
		children[1]?.on.stderr?.("error: unknown command 'health'\n");
		children[1]?.on.exit?.(1);
		expect(said).toHaveLength(1);
		expect(said[0]).toContain("unknown command 'health'");
	});

	it("A19 — stopping the reader is not a failure", () => {
		const { children, said, reader } = run();
		reader.stop();
		children[0]?.on.exit?.(null);
		expect(children).toHaveLength(1);
		expect(said).toEqual([]);
	});
});
