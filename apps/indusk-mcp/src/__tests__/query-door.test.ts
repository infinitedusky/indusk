import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { freeLoopbackPort, startQueryDoor } from "../lib/telemetry/query-door.js";

/**
 * day-always-on-deploy — A14: the query door ties its two connections
 * together (Build Phase 4, falsification).
 *
 * The door pipes Jaeger's answer to the client. `pipe` does not forward an
 * error, so when Jaeger dropped its socket mid-response the client's response
 * was never ended — reproduced against this stub: the client was still
 * waiting after 5 s. A browser holding such a response also keeps the door's
 * `close()` from finishing. The other direction is the same shape: a client
 * leaving mid-response left the request to Jaeger open.
 *
 * Jaeger is stubbed by a real HTTP server on loopback: the subject is the
 * door's handling of a connection, which a stub can break on demand and a
 * real Jaeger cannot.
 */

const servers: Server[] = [];

async function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
	const port = await freeLoopbackPort();
	const server = createServer(handler);
	await new Promise<void>((r) => server.listen(port, "127.0.0.1", () => r()));
	servers.push(server);
	return port;
}

afterEach(async () => {
	for (const s of servers.splice(0)) {
		s.closeAllConnections();
		await new Promise((r) => s.close(() => r(undefined)));
	}
});

async function door(jaegerPort: number): Promise<number> {
	const publicPort = await freeLoopbackPort();
	servers.push(await startQueryDoor({ publicPort, jaegerPort }));
	return publicPort;
}

describe("A14 — the door's two connections live and die together", () => {
	it("Jaeger dropping mid-response ends the client's response with an error, promptly", async () => {
		const jaegerPort = await listen((req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.write("partial");
			setTimeout(() => req.socket.destroy(), 100);
		});
		const publicPort = await door(jaegerPort);

		const started = Date.now();
		const outcome = await Promise.race([
			fetch(`http://127.0.0.1:${publicPort}/api/traces`)
				.then((r) => r.text())
				.then(
					() => "ended cleanly",
					() => "errored",
				),
			new Promise<string>((r) => setTimeout(() => r("still open after 3 s"), 3_000)),
		]);
		// A clean end would pass a truncated body off as a whole one; an error
		// is the only honest answer to a response cut short.
		expect(outcome).toBe("errored");
		expect(Date.now() - started).toBeLessThan(3_000);
	});

	it("a client leaving mid-response closes the request to Jaeger", async () => {
		let upstreamClosed: () => void = () => {};
		const closed = new Promise<string>((r) => {
			upstreamClosed = () => r("closed");
		});
		const jaegerPort = await listen((req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.write("first chunk of a long answer");
			req.socket.once("close", () => upstreamClosed());
		});
		const publicPort = await door(jaegerPort);

		const abort = new AbortController();
		const res = await fetch(`http://127.0.0.1:${publicPort}/api/traces`, {
			signal: abort.signal,
		});
		const reader = res.body?.getReader();
		await reader?.read();
		abort.abort();

		const outcome = await Promise.race([
			closed,
			new Promise<string>((r) =>
				setTimeout(() => r("Jaeger's request still open after 3 s"), 3_000),
			),
		]);
		expect(outcome).toBe("closed");
	});
});
