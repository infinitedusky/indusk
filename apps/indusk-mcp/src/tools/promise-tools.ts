import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confirmPlan } from "../lib/promises/confirm.js";
import { openIncidentsAt, promiseHealth } from "../lib/promises/health.js";
import { WatcherBlind } from "../lib/promises/probe.js";
import { readPromises } from "../lib/promises/registry.js";
import {
	changePromise,
	declarePromise,
	PromiseWriteRefused,
	replacePromise,
	withdrawPromise,
} from "../lib/promises/write.js";
import { isRootsRefusal, resolveExecutionRoots } from "../lib/worktree/roots.js";

/**
 * The promise tools: reading the registry and its health, and the commands
 * the planner and the retrospective call to write it (planner-promises ADR
 * D4, D5). Each reads and writes only through `lib/promises/`, the same calls
 * the CLI makes, so the two cannot disagree. Every result is JSON; a refusal
 * is an error naming what was wrong.
 */
export function registerPromiseTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"list_promises",
		{
			description:
				"The promise registry (.indusk/promises/): every promise with its kind, lifetime, state, domain, owner, statement and links, plus every incident — or, when the registry is missing or an entry is malformed, the problem naming the file and the field. No filtering; read it the way /catchup reads plans.",
			inputSchema: {},
		},
		async () => {
			const read = readPromises(projectRoot);
			const text = JSON.stringify(read, null, 2);
			return { content: [{ type: "text" as const, text }] };
		},
	);

	/** A registry write as a tool result: what was written, or the refusal as an error. JSON, as every tool here returns. */
	const written = (run: () => Record<string, unknown>) => {
		const text = (value: unknown) => [
			{ type: "text" as const, text: JSON.stringify(value, null, 2) },
		];
		try {
			return { content: text(run()) };
		} catch (err) {
			if (!(err instanceof PromiseWriteRefused)) throw err;
			return { isError: true, content: text({ error: err.message }) };
		}
	};
	const promiseFields = {
		plan: z.string().describe("The plan making the promise: a folder under .indusk/planning/."),
		kind: z
			.string()
			.describe(
				"behaviour (breaks on inputs nobody chose; watched in the running system), state (breaks on a later change; a test), or structure (breaks when something is removed or duplicated; a build-time check). Assign it from the sentence; the person can correct it.",
			),
		domain: z.string().describe("One of the project's declared domains (promises.domains)."),
		statement: z.string().describe("The promise in one plain sentence, as the person approved it."),
	};

	server.registerTool(
		"declare_promise",
		{
			description:
				"Write a promise from a planning conversation into the registry: `declared`, owned by the plan, with the sentence the person approved. Call it once the person has confirmed the sentence — never write a registry file by hand. A project that declares no domains gets this promise's domain declared. Refuses, with nothing written, a name the registry already holds (use change_promise), a plan that is not an open plan folder, or a domain the project does not declare.",
			inputSchema: {
				name: z.string().describe("kebab-case, starting with a letter; it becomes the file name."),
				...promiseFields,
			},
		},
		async ({ name, plan, kind, domain, statement }) =>
			written(() => {
				declarePromise(projectRoot, { name, plan, kind, domain, statement });
				return { declared: name, owner: plan, state: "declared" };
			}),
	);

	server.registerTool(
		"change_promise",
		{
			description:
				"Improve an existing promise in place when a plan partly changes what it commits to: its sentence is replaced, the plan takes it over, and its History keeps the old sentence, the reason and the plan that owned it before. Its name, state, incidents and the marks that name it are untouched. Use replace_promise instead when the name no longer describes it.",
			inputSchema: {
				name: z.string().describe("The promise to change."),
				plan: z.string().describe("The plan changing it."),
				statement: z.string().describe("The promise as it now reads, in one plain sentence."),
				reason: z.string().describe("Why it changed, in a sentence."),
			},
		},
		async ({ name, plan, statement, reason }) =>
			written(() => {
				const before = readPromises(projectRoot);
				const was = before.ok ? before.registry.promises.find((p) => p.name === name) : undefined;
				changePromise(projectRoot, { name, plan, statement, reason });
				return { changed: name, owner: plan, previousOwner: was?.owner ?? null };
			}),
	);

	server.registerTool(
		"replace_promise",
		{
			description:
				"Replace a promise whose name no longer describes it: declares the new promise recording which it replaces. The old one stays in force until the plan closes, when it is retired.",
			inputSchema: {
				old: z.string().describe("The promise being replaced."),
				name: z.string().describe("The new promise's name."),
				...promiseFields,
			},
		},
		async ({ old, name, plan, kind, domain, statement }) =>
			written(() => {
				replacePromise(projectRoot, { old, name, plan, kind, domain, statement });
				return { declared: name, owner: plan, supersedes: old, retiredAt: "the plan's close" };
			}),
	);

	server.registerTool(
		"withdraw_promise",
		{
			description:
				"Take back a promise this plan declared and the person then dropped or renamed, before it was ever in force: its registry file is removed. A rename is withdraw_promise then declare_promise. Refuses a promise that is not declared (one in force is replaced, never withdrawn), one another plan declared, and one that lists an incident. Edit the brief to match.",
			inputSchema: {
				name: z.string().describe("The promise to withdraw."),
				plan: z.string().describe("The plan that declared it."),
			},
		},
		async ({ name, plan }) =>
			written(() => {
				withdrawPromise(projectRoot, { name, plan });
				return { withdrawn: name, by: plan };
			}),
	);

	server.registerTool(
		"confirm_promises",
		{
			description:
				"Close a plan's promises, before the retrospective archives it: each promise the plan declared becomes enforced, with the test files its rows name and the code that carries its token; a promise it replaces is retired; one already in force that its rows name has its links brought up to date. Works on an archived plan that closed without confirming. Refuses, naming each promise, when no passing row names it, a test file its row names is missing or does not carry its token, or no code carries it — and then writes nothing.",
			inputSchema: {
				plan: z.string().describe("The plan closing: a folder under .indusk/planning/."),
				code_root: z
					.string()
					.optional()
					.describe(
						"Where the plan's code and tests are. Defaults to the project's code root; in a workbench before landing, pass the plan's own worktree.",
					),
			},
		},
		async ({ plan, code_root }) => {
			const text = (value: unknown, isError = false) => ({
				...(isError ? { isError: true } : {}),
				content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
			});
			let codeRoot = code_root;
			if (codeRoot === undefined) {
				const roots = resolveExecutionRoots(projectRoot);
				if (isRootsRefusal(roots)) return text({ error: roots.error }, true);
				codeRoot = roots.codeRoot;
			}
			const result = await confirmPlan({ planRoot: projectRoot, codeRoot, plan });
			if (!result.ok) {
				return text({ refusals: result.refusals, written: result.written }, true);
			}
			return text({ plan, confirmed: result.confirmed });
		},
	);

	server.registerTool(
		"promise_health",
		{
			description:
				"What the promises are doing right now: per behaviour promise, violations in the window, open incidents, and — the number that matters — violations no incident records yet. Ask this when answering what to work on next; unrecorded violations outrank the roadmap. Reads every source — `local` (the daemon) and, when the project names one, `production` (its always-on server) — through the same reads the CLI uses, so the two cannot disagree. `sources` holds each source's rows or its failure; the top-level fields are the alarm source's (production when there is one), so a local break during development is shown under `sources` without being raised. Errors only when no source can be read.",
			inputSchema: {
				since_ms: z
					.number()
					.optional()
					.describe("Window in milliseconds; defaults to the project's quiet window."),
			},
		},
		async ({ since_ms }) => {
			try {
				const report = await promiseHealth(projectRoot, {
					...(since_ms !== undefined ? { sinceMs: since_ms } : {}),
				});
				return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
			} catch (err) {
				// Unreachable telemetry is reported, never rendered as zero
				// violations: "nothing is broken" and "nobody could look" are
				// different answers and only one of them is reassuring.
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									error: (err as Error).message,
									// A watcher that answered and did not hear is its own
									// state, so a session can say so rather than "unreachable".
									...(err instanceof WatcherBlind ? { blind: true } : {}),
									promises: null,
									// The incidents are files: nobody could look at Jaeger, and
									// the open incidents are still loud (incident-recording A10).
									openIncidents: openIncidentsAt(projectRoot),
								},
								null,
								2,
							),
						},
					],
				};
			}
		},
	);
}
