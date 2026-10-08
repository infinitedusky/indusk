import type { LineWriter } from "./redact.js";
import type { SecretsFile } from "./secrets-file.js";

/** Points a project at a recording server it can read back. Built in Build Phase 1. */
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

export async function connect(_input: ConnectInput, _deps: ConnectDeps): Promise<Connected> {
	throw new Error("connect: not built yet");
}
