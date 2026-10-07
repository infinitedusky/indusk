#!/usr/bin/env node
// promise: the-deployed-demo-page-answers — demo-app-template A10.
//
// After the seat-holds example is deployed, its page answers at the deployed
// address. Run at deploy: SEAT_HOLDS_URL=https://<app>.fly.dev node examples/seat-holds-smoke-deployed.mjs
// Exit 0 only on a 200 whose body is the seat page; otherwise say why and exit 1.

const url = process.env.SEAT_HOLDS_URL;
if (!url) {
	console.error("smoke: SEAT_HOLDS_URL is not set — name the deployed address to check");
	process.exit(1);
}

try {
	const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
	const body = await res.text();
	if (res.status !== 200) {
		console.error(`smoke: ${url} answered ${res.status}`);
		process.exit(1);
	}
	if (!body.includes("<title>Seat holds</title>")) {
		console.error(`smoke: ${url} answered 200, but not with the seat page`);
		process.exit(1);
	}
	console.log(`smoke: ${url} answers with the seat page`);
} catch (err) {
	console.error(`smoke: ${url} did not answer — ${err.message}`);
	process.exit(1);
}
