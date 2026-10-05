/**
 * Run `fn` with `vars` set on `process.env`, and put every one back as it
 * was — deleted when it was unset — whether `fn` returns or throws. For a
 * test that calls code in-process which reads the environment (an MCP tool,
 * a library read) rather than spawning a CLI with its own env.
 */
export async function withEnv<T>(
	vars: Record<string, string>,
	fn: () => Promise<T> | T,
): Promise<T> {
	const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
	Object.assign(process.env, vars);
	try {
		return await fn();
	} finally {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}
