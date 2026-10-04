import { createServer, request, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";

/**
 * The always-on server's public query door (day-always-on-deploy A12).
 *
 * Jaeger's basic auth — the collector's `basicauth` extension — refuses a
 * request with a bare 401 and no `WWW-Authenticate` challenge. A program sends
 * its credentials up front and never notices. A browser is never asked, so it
 * never shows a login box, and the trace link a person clicks from Slack says
 * "no basic auth provided" and nothing else.
 *
 * So the server's own process answers the public query port and passes every
 * request through to Jaeger, which listens on loopback only. When Jaeger
 * refuses, the door adds the challenge. Jaeger stays the only thing that
 * checks a password: the door forwards credentials untouched and decides
 * nothing.
 */
export const LOGIN_CHALLENGE = 'Basic realm="indusk always-on", charset="UTF-8"';

/** A free TCP port on loopback, for Jaeger's query API behind the door. */
export function freeLoopbackPort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createNetServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			if (address && typeof address === "object") probe.close(() => resolve(address.port));
			else reject(new Error("no loopback port"));
		});
	});
}

export function startQueryDoor(opts: { publicPort: number; jaegerPort: number }): Promise<Server> {
	const door = createServer((req, res) => {
		const upstream = request(
			{
				host: "127.0.0.1",
				port: opts.jaegerPort,
				method: req.method,
				path: req.url,
				headers: req.headers,
			},
			(answer) => {
				const headers = { ...answer.headers };
				if (answer.statusCode === 401) headers["www-authenticate"] = LOGIN_CHALLENGE;
				res.writeHead(answer.statusCode ?? 502, headers);
				answer.pipe(res);
			},
		);
		upstream.on("error", () => {
			if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
			res.end("the query API is not answering yet");
		});
		req.pipe(upstream);
	});
	return new Promise((resolve, reject) => {
		door.once("error", reject);
		door.listen(opts.publicPort, "0.0.0.0", () => resolve(door));
	});
}
