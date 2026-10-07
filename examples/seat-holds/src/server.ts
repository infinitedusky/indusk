/**
 * The seat-holds server: the page, the seat API, the fault switch, and a
 * sweeper that releases lapsed holds once a second and marks each release.
 *
 * Configuration, all optional:
 *   PORT                      the page and API (default 8080)
 *   SEAT_HOLDS_SEATS          how many seats (default 8)
 *   SEAT_HOLDS_WINDOW_MS      how long a hold lasts (default 5000)
 *   SEAT_HOLDS_TOLERANCE_MS   how late a release may be and still keep the promise (default 1500)
 *   SEAT_HOLDS_FAULT_TOGGLE=1 show the "Break it" switch on the page (local only)
 *   SEAT_HOLDS_FAULT=slow-release  start with the fault on (for a deployed break)
 */
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createSeats } from "./seats.js";
import { markRelease, startTelemetry, stopTelemetry } from "./telemetry.js";

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

const port = num(process.env.PORT, 8080);
const toggle = process.env.SEAT_HOLDS_FAULT_TOGGLE === "1";
let fault = process.env.SEAT_HOLDS_FAULT === "slow-release";

const seats = createSeats({
	seats: num(process.env.SEAT_HOLDS_SEATS, 8),
	windowMs: num(process.env.SEAT_HOLDS_WINDOW_MS, 5000),
	toleranceMs: num(process.env.SEAT_HOLDS_TOLERANCE_MS, 1500),
});

const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf-8");

startTelemetry();
const sweeper = setInterval(() => {
	for (const r of seats.sweep(Date.now(), { fault })) markRelease(r);
}, 1000);

function send(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
	let raw = "";
	for await (const chunk of req) raw += chunk;
	try {
		return JSON.parse(raw || "{}") as Record<string, unknown>;
	} catch {
		return {};
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	if (req.method === "GET" && url.pathname === "/") {
		res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
		res.end(page);
		return;
	}
	if (req.method === "GET" && url.pathname === "/seats") {
		send(res, 200, { seats: seats.list(Date.now()), fault, toggle });
		return;
	}
	if (req.method === "POST" && (url.pathname === "/hold" || url.pathname === "/book")) {
		const body = await readJson(req);
		const seat = Number(body.seat);
		const who = typeof body.who === "string" && body.who !== "" ? body.who : "guest";
		const r =
			url.pathname === "/hold"
				? seats.hold(seat, who, Date.now())
				: seats.book(seat, who, Date.now());
		send(res, r.ok ? 200 : 409, r);
		return;
	}
	if (req.method === "POST" && url.pathname === "/fault") {
		if (!toggle) {
			send(res, 403, {
				error: "the fault switch is off here; set SEAT_HOLDS_FAULT_TOGGLE=1 to show it",
			});
			return;
		}
		fault = (await readJson(req)).on === true;
		send(res, 200, { fault });
		return;
	}
	send(res, 404, { error: "not found" });
});

server.listen(port, () => {
	console.log(`Seat page: http://localhost:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		clearInterval(sweeper);
		server.close();
		void stopTelemetry().finally(() => process.exit(0));
	});
}
