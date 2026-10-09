// Runs inside VS Code's extension host for A5, A11, A14 against the running
// demo app: read the markers through the extension's test command, break the
// promise, time the marker, then run Fix with Claude.
const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROMISE = "a-held-seat-is-released-in-time";

exports.run = async () => {
	const out = { a5: null, a11: null, a14: null, a25: null, a28: null };
	const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const doc = await vscode.workspace.openTextDocument(path.join(root, "src", "telemetry.ts"));
	await vscode.window.showTextDocument(doc);
	const markers = () => vscode.commands.executeCommand("indusk.test.markers");
	for (let i = 0; i < 40; i++) {
		const m = (await markers()) || [];
		const mine = m.find((x) => x.promise === PROMISE);
		if (mine && !/not reading/.test(mine.text)) {
			out.a5 = mine;
			break;
		}
		await sleep(500);
	}
	const url = process.env.DEMO_URL || "http://localhost:8080";
	const panel = () => vscode.commands.executeCommand("indusk.test.panel");
	const post = (path, body) =>
		fetch(`${url}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});

	// A25: the panel lists the demo's promise; its telemetry location opens the file at the token.
	{
		let mine = null;
		for (let i = 0; i < 40 && !mine; i++) {
			const p = (await panel()) || { model: { broken: [], groups: [] } };
			mine =
				[...p.model.broken, ...p.model.groups.flatMap((g) => g.promises)].find(
					(x) => x.name === PROMISE,
				) || null;
			if (!mine) await sleep(500);
		}
		const site = mine?.locations.find((l) => l.kind === "site" && l.path === "src/telemetry.ts");
		if (site) {
			await vscode.commands.executeCommand("indusk.openLocation", site.path, site.line);
			const ed = vscode.window.activeTextEditor;
			out.a25 = {
				listed: Boolean(mine),
				opened: ed ? path.relative(root, ed.document.uri.fsPath) : null,
				line: ed ? ed.selection.active.line : null,
				tokenLine: site.line,
			};
		} else out.a25 = { listed: Boolean(mine), opened: null };
	}

	// A28 (held): a hold that lapses on time adds a "held" run to the activity section.
	// Only runs after this hold count: the demo tags no project, so runs from
	// another seat-holds on this machine, or an earlier session, are listed too.
	const newRun = (p, outcome, since) =>
		(p.runs || []).find(
			(r) => r.promise === PROMISE && r.outcome === outcome && Date.parse(r.at) >= since,
		);
	await post("/fault", { on: false });
	const heldFrom = Date.now();
	await post("/hold", { seat: 2, who: "live" });
	for (let i = 0; i < 120 && !out.a28?.held; i++) {
		const run = newRun((await panel()) || {}, "upheld", heldFrom);
		if (run) out.a28 = { held: run.at };
		else await sleep(250);
	}
	await fetch(`${url}/fault`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ on: true }),
	});
	await fetch(`${url}/hold`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ seat: 1, who: "live" }),
	});
	const heldAt = Date.now();
	// The break happens when the late release is marked, not at the hold: the
	// fault holds the release back past its window on purpose. A11's clock
	// starts there; the total from the hold is recorded beside it.
	let brokeAt = null;
	for (let i = 0; i < 240; i++) {
		if (brokeAt === null) {
			const seats = await (await fetch(`${url}/seats`)).json();
			if (seats.seats.find((x) => x.seat === 1)?.state === "free") brokeAt = Date.now();
		}
		const mine = ((await markers()) || []).find((x) => x.promise === PROMISE);
		if (mine && mine.tone === "broken") {
			const now = Date.now();
			out.a11 = {
				seconds: (now - (brokeAt ?? heldAt)) / 1000,
				fromHold: (now - heldAt) / 1000,
				text: mine.text,
			};
			break;
		}
		await sleep(250);
	}
	// A28 (broke): the faulted hold's late release adds a "broke" run.
	for (let i = 0; i < 120 && !out.a28?.broke; i++) {
		const run = newRun((await panel()) || {}, "violated", heldAt);
		if (run) out.a28 = { ...(out.a28 || {}), broke: run.at };
		else await sleep(250);
	}
	await post("/fault", { on: false });
	await vscode.commands.executeCommand("indusk.fixWithClaude", PROMISE);
	await sleep(1000);
	const term = vscode.window.terminals.find((t) => t.name === `Claude — ${PROMISE}`);
	out.a14 = { terminal: Boolean(term) };
	if (term) term.dispose();
	fs.writeFileSync(process.env.LIVE_OUT, JSON.stringify(out));
};
