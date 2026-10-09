import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import * as vscode from "vscode";
import { fixFor } from "./core/fix.js";
import { hover } from "./core/hover.js";
import { type Marker, markers } from "./core/markers.js";
import { type ReaderChild, startReader } from "./core/reader.js";
import {
	type Break,
	onLine,
	onTick,
	problems,
	type Session,
	startSession,
} from "./core/session.js";
import { type HealthLine, promiseOf } from "./core/view.js";

/**
 * The VS Code layer (vscode-extension ADR D3): it runs one
 * `indusk promises health --json --every 5` child, feeds each line to the
 * pure core, and applies what the core returns. No rule is decided here,
 * and nothing is written to the project.
 */

const CADENCE_MS = 5_000;
const TONES: Marker["tone"][] = ["broken", "ok", "unknown", "proves"];
const COLOUR: Record<Marker["tone"], string> = {
	broken: "editorError.foreground",
	ok: "testing.iconPassed",
	unknown: "editorWarning.foreground",
	proves: "descriptionForeground",
};

export function activate(context: vscode.ExtensionContext): void {
	const root = vscode.workspace.workspaceFolders?.find((f) =>
		existsSync(join(f.uri.fsPath, ".indusk", "config.json")),
	)?.uri.fsPath;
	if (!root) return;

	let session: Session = startSession(CADENCE_MS);
	const decorations = Object.fromEntries(
		TONES.map((tone) => [
			tone,
			vscode.window.createTextEditorDecorationType({
				after: { margin: "0 0 0 2em", color: new vscode.ThemeColor(COLOUR[tone]) },
			}),
		]),
	) as Record<Marker["tone"], vscode.TextEditorDecorationType>;
	const diagnostics = vscode.languages.createDiagnosticCollection("indusk");
	context.subscriptions.push(diagnostics, ...Object.values(decorations));

	// Nested InDusk projects keep their own promises (A22): found once, at activation.
	let nested: string[] = [];
	const markersFor = (doc: vscode.TextDocument) =>
		markers({ path: relative(root, doc.uri.fsPath), text: doc.getText() }, session.view, {
			nested,
		});

	const paint = () => {
		for (const editor of vscode.window.visibleTextEditors) {
			const byTone = Object.fromEntries(TONES.map((t) => [t, [] as vscode.DecorationOptions[]]));
			for (const m of markersFor(editor.document)) {
				const end = editor.document.lineAt(m.line).range.end;
				byTone[m.tone]?.push({
					range: new vscode.Range(end, end),
					renderOptions: { after: { contentText: m.text } },
				});
			}
			for (const tone of TONES) editor.setDecorations(decorations[tone], byTone[tone] ?? []);
		}
	};
	void vscode.workspace
		.findFiles(new vscode.RelativePattern(root, "**/.indusk/config.json"), "**/node_modules/**")
		.then((found) => {
			nested = found
				.map((uri) => dirname(dirname(relative(root, uri.fsPath))))
				.filter((dir) => dir !== ".");
			paint();
		});

	const diagnose = async () => {
		const view = session.view;
		const found = new Map<string, vscode.Diagnostic[]>();
		for (const p of problems(session)) {
			for (const site of promiseOf(view, p.promise)?.sites ?? []) {
				const uri = vscode.Uri.file(join(root, site));
				let text: string;
				try {
					text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf-8");
				} catch {
					continue;
				}
				for (const m of markers({ path: site, text }, view).filter(
					(x) => x.promise === p.promise,
				)) {
					const d = new vscode.Diagnostic(
						new vscode.Range(m.line, 0, m.line, 0),
						p.message,
						vscode.DiagnosticSeverity.Error,
					);
					d.source = "InDusk";
					found.set(uri.toString(), [...(found.get(uri.toString()) ?? []), d]);
				}
			}
		}
		diagnostics.clear();
		for (const [uri, list] of found) diagnostics.set(vscode.Uri.parse(uri), list);
	};

	const fix = (promise: string) => {
		const action = fixFor(session.view, promise, {
			projectRoot: root,
			claudeOnPath: spawnSync("which", ["claude"]).status === 0,
		});
		if (!action) return;
		if ("message" in action) {
			void vscode.window.showErrorMessage(action.message);
			return;
		}
		const terminal = vscode.window.createTerminal({
			cwd: action.terminal.cwd,
			name: action.terminal.name,
		});
		terminal.show();
		terminal.sendText(action.terminal.command);
	};

	const tell = (b: Break) => {
		void vscode.window
			.showWarningMessage(
				`${b.promise} is broken in ${b.source}${b.symptom ? `: ${b.symptom}` : ""}`,
				"Fix with Claude",
			)
			.then((choice) => {
				if (choice) fix(b.promise);
			});
	};

	// One long-lived reader; restarted once, then reported (core/reader).
	const command = vscode.workspace.getConfiguration("indusk").get<string>("command") ?? "indusk";
	const reader = startReader({
		command,
		everySeconds: CADENCE_MS / 1000,
		spawn: (cmd, args) => nodeChild(cmd, args, root),
		onLine: (text) => {
			let line: HealthLine;
			try {
				line = JSON.parse(text) as HealthLine;
			} catch {
				return;
			}
			const r = onLine(session, line, Date.now());
			session = r.session;
			for (const b of r.notify) tell(b);
			paint();
			void diagnose();
		},
		onStopped: (message) => {
			void vscode.window.showErrorMessage(message);
		},
	});
	const ticker = setInterval(() => {
		const next = onTick(session, Date.now());
		if (next !== session) {
			session = next;
			paint();
		}
	}, 1_000);

	context.subscriptions.push(
		{ dispose: () => clearInterval(ticker) },
		{ dispose: () => reader.stop() },
		vscode.window.onDidChangeVisibleTextEditors(paint),
		vscode.workspace.onDidChangeTextDocument(paint),
		vscode.languages.registerHoverProvider(
			{ scheme: "file" },
			{
				provideHover(doc, position) {
					const m = markersFor(doc).find((x) => x.line === position.line);
					return m
						? new vscode.Hover(new vscode.MarkdownString(hover(m.promise, session.view)))
						: undefined;
				},
			},
		),
		vscode.languages.registerCodeActionsProvider(
			{ scheme: "file" },
			{
				provideCodeActions(doc, range) {
					return markersFor(doc)
						.filter((m) => m.tone === "broken" && m.line === range.start.line)
						.map((m) => {
							const a = new vscode.CodeAction(
								`Fix ${m.promise} with Claude`,
								vscode.CodeActionKind.QuickFix,
							);
							a.command = {
								command: "indusk.fixWithClaude",
								title: "Fix with Claude",
								arguments: [m.promise],
							};
							return a;
						});
				},
			},
		),
		vscode.commands.registerCommand("indusk.fixWithClaude", (promise: string) => fix(promise)),
		// For the live checks: the markers the active editor shows now.
		vscode.commands.registerCommand("indusk.test.markers", () => {
			const doc = vscode.window.activeTextEditor?.document;
			return doc ? markersFor(doc) : [];
		}),
	);
}

export function deactivate(): void {}

/** A Node child process as the reader sees it: lines in, stderr, exit, error. */
function nodeChild(command: string, args: string[], cwd: string): ReaderChild {
	const child = spawn(command, args, {
		cwd,
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return {
		onLine: (cb) => {
			createInterface({ input: child.stdout }).on("line", cb);
		},
		onStderr: (cb) => {
			child.stderr.setEncoding("utf-8");
			child.stderr.on("data", cb);
		},
		onExit: (cb) => {
			child.on("exit", cb);
		},
		onError: (cb) => {
			child.on("error", cb);
		},
		kill: () => {
			child.kill();
		},
	};
}
