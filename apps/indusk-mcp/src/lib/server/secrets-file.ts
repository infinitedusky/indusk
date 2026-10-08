import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileDurably } from "../always-on/durable-write.js";
import { induskHome } from "../telemetry/status.js";

/**
 * The machine's secrets file, `~/.indusk/config.env`: one `NAME=value` per
 * line, read and written by owner only. A project's config names a variable;
 * its value lives here, never in anything committed (server-provisioning A2).
 *
 * This is the one writer. A `set` replaces the line of that name and keeps
 * every other line as it was — the file also holds what a person put there by
 * hand (the deployed server's credential, the infra host).
 */
export interface SecretsFile {
	readonly path: string;
	get(name: string): string | undefined;
	set(name: string, value: string): void;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LINE_SEPARATOR = /[\r\n\u2028\u2029]/;

export function secretsFile(path: string): SecretsFile {
	const lines = (): string[] => (existsSync(path) ? readFileSync(path, "utf-8").split("\n") : []);
	const keyOf = (line: string): string | null => {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
		return m ? (m[1] as string) : null;
	};
	return {
		path,
		get(name) {
			const line = lines().find((l) => keyOf(l) === name);
			if (line === undefined) return undefined;
			const value = line.slice(line.indexOf("=") + 1).trim();
			return value.replace(/^(["'])(.*)\1$/, "$2") || undefined;
		},
		set(name, value) {
			if (!NAME.test(name)) throw new Error(`not a variable name: ${JSON.stringify(name)}`);
			if (LINE_SEPARATOR.test(value)) {
				throw new Error(
					`the value for ${name} holds a line separator, which would add a line to ${path}`,
				);
			}
			const kept = lines().filter((l) => keyOf(l) !== name);
			while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
			writeFileDurably(path, `${[...kept, `${name}=${value}`].join("\n")}\n`, 0o600);
		},
	};
}

/**
 * This machine's secrets file: `config.env` in the InDusk home
 * (`$INDUSK_HOME`, else `~/.indusk`). Located here and nowhere else, so what
 * `server connect` writes is what a promise read finds (server-provisioning A26).
 */
export function machineSecrets(): SecretsFile {
	return secretsFile(join(induskHome(), "config.env"));
}
