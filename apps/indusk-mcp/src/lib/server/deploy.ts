import type { Connected, ConnectInput } from "./connect.js";
import type { FlyCli } from "./fly.js";
import type { LineWriter } from "./redact.js";
import type { SecretsFile } from "./secrets-file.js";

/** `indusk server deploy`: one command into the person's own Fly account. Built in Build Phase 2. */
export interface DeployInput {
	projectRoot: string;
	projectName: string;
	app?: string;
	org?: string;
	region?: string;
	version: string;
	slackWebhook?: string | null;
	rotate?: boolean;
}

export interface DeployDeps {
	fly: FlyCli;
	connect(input: ConnectInput, out: LineWriter): Promise<Connected>;
	secrets: SecretsFile;
	/** Where every line goes, before redaction. */
	print(line: string): void;
	/** A new server password. */
	random(): string;
	/** A directory for the generated Fly config. */
	tempDir(): string;
}

export async function deploy(_input: DeployInput, _deps: DeployDeps): Promise<void> {
	throw new Error("deploy: not built yet");
}
