import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Slack, as the always-on pass talks to it (day-always-on, Test Phase 1).
 *
 * An incoming webhook is one URL and one POST, so the test gives the pass a
 * URL of its own and reads what arrived. Mirrors `otlp-capture.ts`: capture
 * at the wire, assert on the payload, and record a body it could not read
 * rather than dropping it.
 *
 * `refusing()` is a URL nothing listens on — the A9 case, where the pass must
 * leave the violation unannounced rather than lose it.
 */

export interface SlackCapture {
	/** The webhook URL to give the pass. */
	url: string;
	/** Every payload posted, in order. */
	posts: () => unknown[];
	/** Every payload's `text`, for the common assertion. */
	texts: () => string[];
	/** Bodies that were not JSON, with their content type. */
	refused: () => string[];
	/** Resolve once at least `count` posts have arrived; throws after `timeoutMs`. */
	waitForPosts: (count: number, timeoutMs?: number) => Promise<unknown[]>;
	close: () => Promise<void>;
}

export async function startSlackCapture(): Promise<SlackCapture> {
	const posts: unknown[] = [];
	const refused: string[] = [];
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (c: Buffer) => chunks.push(c));
		req.on("end", () => {
			const type = req.headers["content-type"] ?? "";
			const raw = Buffer.concat(chunks).toString("utf-8");
			if (type.includes("json")) {
				try {
					posts.push(JSON.parse(raw));
				} catch {
					refused.push(`${type} (unparseable)`);
				}
			} else {
				refused.push(String(type));
			}
			// Slack answers a webhook with a plain "ok".
			res.writeHead(200, { "content-type": "text/plain" });
			res.end("ok");
		});
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const { port } = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${port}/services/T000/B000/fixture`,
		posts: () => [...posts],
		texts: () =>
			posts.map((p) =>
				typeof p === "object" && p !== null ? String((p as { text?: unknown }).text ?? "") : "",
			),
		refused: () => [...refused],
		async waitForPosts(count, timeoutMs = 20_000) {
			const deadline = Date.now() + timeoutMs;
			while (posts.length < count) {
				if (Date.now() > deadline) {
					throw new Error(
						`slack-capture: ${posts.length} post(s) after ${timeoutMs}ms, wanted ${count}${refused.length ? `; refused: ${refused.join(", ")}` : ""}`,
					);
				}
				await new Promise((r) => setTimeout(r, 200));
			}
			return [...posts];
		},
		close: () => new Promise<void>((r) => server.close(() => r())),
	};
}

/**
 * A webhook URL nothing answers: the port is bound and closed, so a POST is
 * refused rather than hanging. What the pass must survive without marking the
 * violation announced.
 */
export async function refusingSlackUrl(): Promise<string> {
	const server = createServer(() => {});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const { port } = server.address() as AddressInfo;
	await new Promise<void>((r) => server.close(() => r()));
	return `http://127.0.0.1:${port}/services/T000/B000/gone`;
}
