/** A writer that never prints a secret (server-provisioning A9). Built in Build Phase 1. */
export interface LineWriter {
	line(text: string): void;
}

export function redactingWriter(
	_sink: (line: string) => void,
	_secrets: readonly string[],
): LineWriter {
	throw new Error("redactingWriter: not built yet");
}
