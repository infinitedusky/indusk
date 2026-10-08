/**
 * A writer that never prints a secret (server-provisioning A9).
 *
 * Both server commands print through one of these, built with every secret
 * the run knows — the password it generated, the webhook it was given, the
 * credential it stores. A provider's own output is printed through it too:
 * Fly can echo what it was sent, and a refusal that quotes its input must not
 * post a password to a terminal someone is screen-sharing.
 */
export interface LineWriter {
	line(text: string): void;
}

export const REDACTED = "[redacted]";

export function redactingWriter(sink: (line: string) => void, secrets: readonly string[]): LineWriter {
	// Longest first, so a secret that contains another is replaced whole.
	const known = secrets.filter((s) => s.length > 0).sort((a, b) => b.length - a.length);
	return {
		line(text) {
			let safe = text;
			for (const secret of known) safe = safe.split(secret).join(REDACTED);
			sink(safe);
		},
	};
}
