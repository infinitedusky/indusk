import { randomBytes } from "node:crypto";
import { basename, join } from "node:path";
import * as vscode from "vscode";
import { type Activity, activityLines, addRuns, type Run, startActivity } from "./core/activity.js";
import { panelModel } from "./core/panel.js";
import { panelBody, panelPage } from "./core/panel-html.js";
import type { View } from "./core/view.js";

/**
 * The promises panel in VS Code (vscode-extension ADR decision 7). The core
 * builds its model and HTML; this reads the listed files for their token
 * lines, posts the body, keeps the activity, and opens what is clicked.
 */
export function registerPromisesPanel(
	context: vscode.ExtensionContext,
	deps: { root: string; view: () => View | null; fix: (promise: string) => void },
): { addRuns(runs: Run[]): void; render(): Promise<void> } {
	const { root } = deps;
	let activity: Activity = startActivity();
	let panelView: vscode.WebviewView | null = null;
	const localTime = (iso: string) => new Date(iso).toLocaleTimeString();

	const readListed = async (): Promise<Map<string, string>> => {
		const files = new Map<string, string>();
		for (const p of deps.view()?.line.promises ?? []) {
			for (const path of [...p.tests, ...(p.sites ?? [])]) {
				if (files.has(path)) continue;
				try {
					const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(join(root, path)));
					files.set(path, Buffer.from(bytes).toString("utf-8"));
				} catch {
					// unreadable: listed without a line
				}
			}
		}
		return files;
	};
	const current = async () => ({
		model: panelModel(deps.view(), await readListed()),
		activity: activityLines(activity, localTime),
		runs: activity.runs,
	});
	const render = async () => {
		if (!panelView) return;
		const { model, activity: lines } = await current();
		void panelView.webview.postMessage({
			type: "render",
			body: panelBody(model, lines, basename(root)),
		});
	};
	const openLocation = async (path: string, line: number | null) => {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(join(root, path)));
		const at = line === null ? undefined : new vscode.Range(line, 0, line, 0);
		await vscode.window.showTextDocument(doc, at ? { selection: at } : {});
	};

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("indusk.promises", {
			resolveWebviewView(view) {
				panelView = view;
				view.webview.options = { enableScripts: true };
				view.webview.html = panelPage(randomBytes(16).toString("base64"), view.webview.cspSource);
				view.webview.onDidReceiveMessage(
					(m: { type: string; path?: string; line?: number | null; promise?: string }) => {
						if (m.type === "ready") void render();
						else if (m.type === "open" && typeof m.path === "string")
							void openLocation(m.path, typeof m.line === "number" ? m.line : null);
						else if (m.type === "fix" && typeof m.promise === "string") deps.fix(m.promise);
					},
				);
				view.onDidDispose(() => {
					panelView = null;
				});
			},
		}),
		vscode.commands.registerCommand("indusk.openLocation", (path: string, line: number | null) =>
			openLocation(path, line),
		),
		// For the live checks: the panel's model and activity as the view shows them.
		vscode.commands.registerCommand("indusk.test.panel", () => current()),
	);

	return {
		addRuns(runs) {
			activity = addRuns(activity, runs);
		},
		render,
	};
}
