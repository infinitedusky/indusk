import { createServer, type Server } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPortListening } from "./status.js";

/**
 * promise-timeline (discovered at Build Phase 4) — a busy event loop is not a
 * closed port.
 *
 * `isPortListening` gives a connection 500 ms, measured on the caller's own
 * event loop. In the admin, `next dev` rendering a page can hold that loop
 * longer; Node's timer phase then fires the timeout before the poll phase
 * delivers the connect, and a listening port reads as closed. `daemonStatus`
 * once took that as a dead daemon and deleted its record, so every later read
 * in the process said "no telemetry daemon is running" (the Promises page's
 * watcher-blind test, after the timeline added one read to the render). It no
 * longer decides from a port at all (it judges the recorded processes by their
 * command lines, `daemon-state.ts`) and no read removes the record; this check
 * stays for the callers that do ask whether a port listens.
 */

let server: Server;
let port = 0;

beforeAll(async () => {
	server = createServer((s) => s.end());
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	port = (server.address() as { port: number }).port;
});

afterAll(() => {
	server.close();
});

/** Hold the event loop, as a busy render does. */
function block(ms: number): void {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		// busy
	}
}

describe("a busy event loop is not a closed port", () => {
	it("a listening port reads as listening even when the loop is held past the timeout", async () => {
		const answer = isPortListening(port);
		block(700);
		expect(
			await answer,
			"lesson: a-timeout-measured-on-a-busy-loop-is-not-a-fact-about-the-port",
		).toBe(true);
	});

	it("a closed port still reads as closed", async () => {
		const closed = createServer();
		await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
		const p = (closed.address() as { port: number }).port;
		await new Promise<void>((r) => closed.close(() => r()));
		expect(await isPortListening(p)).toBe(false);
	});
});
