import type { Location, PanelModel, PanelPromise } from "./panel.js";

/**
 * The promises panel as HTML (vscode-extension ADR decision 7). `panelBody`
 * is sent on every health line; `panelPage` is the page it lands in, loaded
 * once, so open cards and the scroll position survive a refresh. Every text
 * is escaped: symptoms and reasons come from spans.
 */

export function panelBody(model: PanelModel, activity: string[], project = ""): string {
	// Every window reads its own project's promises; the name says whose they are.
	const title = project
		? `<p class="project" title="The project this window has open">${esc(project)}</p>`
		: "";
	const reading = model.notReading ? `<p class="note">Not reading: no promise health yet.</p>` : "";
	const broken =
		model.broken.length > 0
			? `<h2>Broken</h2>${model.broken.map(card).join("")}`
			: `<p class="note">Nothing broken.</p>`;
	const rest = model.groups
		.map(
			(g) =>
				`<h2 class="plan">${esc(g.planTitle)}</h2>${
					g.planWhen ? `<p class="when">${esc(g.planWhen)}</p>` : ""
				}${g.promises.map(row).join("")}`,
		)
		.join("");
	const runs = `<h2>Activity</h2><ol class="activity">${activity
		.map((l) => `<li class="${/ broke /.test(l) ? "broke" : "held"}">${esc(l)}</li>`)
		.join("")}</ol>`;
	return `${title}${reading}${broken}${rest}${runs}`;
}

function card(p: PanelPromise): string {
	const facts = [
		p.plan ? `plan ${esc(p.planTitle ?? p.plan)}` : "",
		p.source ? `in ${esc(p.source)}` : "",
		p.brokeAt ? `last broke ${esc(p.brokeAt.slice(0, 16).replace("T", " "))} UTC` : "",
	]
		.filter(Boolean)
		.join(" · ");
	return `<details class="card" data-name="${esc(p.name)}"><summary><span class="name">${esc(
		p.title,
	)}</span><span class="state broken">${esc(p.state)}</span>${
		facts ? `<span class="facts">${facts}</span>` : ""
	}${p.symptom ? `<span class="symptom">${esc(p.symptom)}</span>` : ""}</summary>${detail(
		p,
	)}<button data-fix="${esc(p.name)}">Fix with Claude</button></details>`;
}

function row(p: PanelPromise): string {
	return `<details class="row" data-name="${esc(p.name)}"><summary><span class="name">${esc(
		p.title,
	)}</span><span class="state ${p.tone}">${esc(p.state)}</span></summary>${detail(p)}</details>`;
}

function detail(p: PanelPromise): string {
	const list = (kind: Location["kind"], title: string) => {
		const items = p.locations.filter((l) => l.kind === kind);
		if (items.length === 0) return "";
		return `<h3>${title}</h3><ul>${items
			.map(
				(l) =>
					`<li><a href="#" data-path="${esc(l.path)}" data-line="${l.line ?? ""}">${esc(l.path)}${
						l.line === null ? " (token not found)" : `:${l.line + 1}`
					}</a></li>`,
			)
			.join("")}</ul>`;
	};
	return `<div class="detail"><p class="statement">${esc(p.statement)}</p>${list(
		"test",
		"Tests",
	)}${list("site", "Kept at")}</div>`;
}

/** The page the body lands in: a strict policy, one nonce, theme colours from VS Code. */
export function panelPage(nonce: string, cspSource: string): string {
	return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
body{font:var(--vscode-font-size) var(--vscode-font-family);color:var(--vscode-foreground);padding:0 8px}
h2.plan{text-transform:none;letter-spacing:0;font-size:12px;font-weight:600}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--vscode-descriptionForeground);margin:14px 0 6px}
h3{font-size:11px;color:var(--vscode-descriptionForeground);margin:8px 0 2px}
details{border-radius:4px;margin:0 0 4px}
summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;padding:4px 6px}
summary::-webkit-details-marker{display:none}
.card{border:1px solid var(--vscode-errorForeground);background:var(--vscode-inputValidation-errorBackground,transparent)}
.row summary:hover{background:var(--vscode-list-hoverBackground)}
.name{font-weight:600}
.when{margin:0 0 4px;color:var(--vscode-descriptionForeground);font-size:12px}
.state{color:var(--vscode-descriptionForeground)}
.state.broken{color:var(--vscode-errorForeground)}
.state.ok{color:var(--vscode-testing-iconPassed)}
.facts,.symptom{flex-basis:100%;color:var(--vscode-descriptionForeground);font-size:12px}
.detail{padding:0 6px 6px}
.statement{margin:4px 0}
ul{margin:0;padding-left:16px}
a{color:var(--vscode-textLink-foreground);text-decoration:none}
a:hover{text-decoration:underline}
button{margin:6px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0;padding:4px 10px;border-radius:2px;cursor:pointer}
.note{color:var(--vscode-descriptionForeground)}
.project{font-weight:600;font-size:13px;margin:10px 0 0}
.activity{list-style:none;padding:0;margin:0;max-height:40vh;overflow-y:auto;font-family:var(--vscode-editor-font-family);font-size:12px}
.activity li{padding:1px 0}
.activity li.broke{color:var(--vscode-errorForeground)}
</style></head><body><div id="root"><p class="note">Not reading: no promise health yet.</p></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const root = document.getElementById("root");
window.addEventListener("message", (e) => {
	if (e.data?.type !== "render") return;
	const open = new Set([...root.querySelectorAll("details[open]")].map((d) => d.dataset.name));
	const scroll = root.querySelector(".activity")?.scrollTop ?? 0;
	root.innerHTML = e.data.body;
	for (const d of root.querySelectorAll("details")) if (open.has(d.dataset.name)) d.open = true;
	const list = root.querySelector(".activity");
	if (list) list.scrollTop = scroll;
});
document.addEventListener("click", (e) => {
	const link = e.target.closest("[data-path]");
	if (link) {
		e.preventDefault();
		const line = link.dataset.line === "" ? null : Number(link.dataset.line);
		vscode.postMessage({ type: "open", path: link.dataset.path, line });
		return;
	}
	const fix = e.target.closest("[data-fix]");
	if (fix) vscode.postMessage({ type: "fix", promise: fix.dataset.fix });
});
vscode.postMessage({ type: "ready" });
</script></body></html>`;
}

function esc(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
