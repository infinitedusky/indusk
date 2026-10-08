/** The machine's secrets file, `~/.indusk/config.env`. Built in Build Phase 1. */
export interface SecretsFile {
	readonly path: string;
	get(name: string): string | undefined;
	set(name: string, value: string): void;
}

export function secretsFile(_path: string): SecretsFile {
	throw new Error("secretsFile: not built yet");
}
