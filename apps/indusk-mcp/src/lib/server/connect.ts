import { readConfig, writeConfig } from "../config.js";
import { probeWatcher } from "../promises/probe.js";
import { jaegerEndpoint } from "../promises/telemetry.js";
import type { LineWriter } from "./redact.js";
import type { SecretsFile } from "./secrets-file.js";

/**
 * `indusk server connect`: point a project at a recording server the person
 * runs, wherever it runs (server-provisioning, ADR D1, D4, D6).
 *
 * The server is read back first — a mark sent through its intake and found
 * through its query API, at the addresses the project will use. Only then is
 * anything written: the project's `promises.jaeger` names the server and the
 * *name* of the credential's variable, and the value goes to the machine's
 * secrets file. A server that does not answer is never named; a project that
 * names one reads *watcher blind* forever after.
 */
export interface ConnectInput {
	projectRoot: string;
	projectName: string;
	queryUrl: string;
	otlpUrl: string;
	credential: string;
}

export interface ConnectDeps {
	probe(target: { queryUrl: string; otlpUrl: string; credential: string }): Promise<void>;
	secrets: SecretsFile;
	out: LineWriter;
}

export interface Connected {
	credentialEnv: string;
}

/** The variable a project's credential is stored under: one per project, so two projects never share one. */
export function credentialEnvFor(projectName: string): string {
	const slug = projectName
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return `INDUSK_SERVER_${slug || "PROJECT"}_CREDENTIAL`;
}

export async function connect(input: ConnectInput, deps: ConnectDeps): Promise<Connected> {
	const config = readConfig(input.projectRoot);
	if (!config) {
		throw new Error(`no InDusk config at ${input.projectRoot} — run \`indusk init\` there first`);
	}
	deps.out.line(`Reading the server back: a mark through ${input.otlpUrl}, found through ${input.queryUrl} …`);
	await deps.probe({ queryUrl: input.queryUrl, otlpUrl: input.otlpUrl, credential: input.credential });

	const credentialEnv = credentialEnvFor(input.projectName);
	deps.secrets.set(credentialEnv, input.credential);
	writeConfig(input.projectRoot, {
		...config,
		promises: {
			...(config.promises ?? { domains: [] }),
			jaeger: { url: input.queryUrl, otlp_url: input.otlpUrl, credential_env: credentialEnv },
		},
	});
	deps.out.line(`Connected: production reads ${input.queryUrl}.`);
	deps.out.line(`The credential is stored as ${credentialEnv} in ${deps.secrets.path}; the project names the variable, never the value.`);
	return { credentialEnv };
}

/** The real read-back: the heartbeat probe every promise read already runs. */
export function probeServer(project: string) {
	return (target: { queryUrl: string; otlpUrl: string; credential: string }) =>
		probeWatcher(
			{ endpoint: jaegerEndpoint(target.queryUrl, target.credential), intakeUrl: target.otlpUrl },
			{ project },
		);
}
