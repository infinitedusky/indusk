// Runs inside VS Code's extension host for A5, A11, A14 against the running
// demo app: read the markers through the extension's test command, break the
// promise, time the marker, then run Fix with Claude.
const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROMISE = "a-held-seat-is-released-in-time";

exports.run = async () => {
	const out = { a5: null, a11: null, a14: null };
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
	await fetch(`${url}/fault`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ on: true }),
	});
	await fetch(`${url}/hold`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ seat: 1, who: "a16" }),
	});
	const brokeAt = Date.now();
	for (let i = 0; i < 120; i++) {
		const mine = ((await markers()) || []).find((x) => x.promise === PROMISE);
		if (mine && mine.tone === "broken") {
			out.a11 = { seconds: (Date.now() - brokeAt) / 1000, text: mine.text };
			break;
		}
		await sleep(250);
	}
	await fetch(`${url}/fault`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ on: false }),
	});
	await vscode.commands.executeCommand("indusk.fixWithClaude", PROMISE);
	await sleep(1000);
	const term = vscode.window.terminals.find((t) => t.name === `Claude — ${PROMISE}`);
	out.a14 = { terminal: Boolean(term) };
	if (term) term.dispose();
	fs.writeFileSync(process.env.LIVE_OUT, JSON.stringify(out));
};
