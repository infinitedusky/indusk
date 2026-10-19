import { readPromises } from "../promises/registry.js";

/**
 * The `<promise>/<clause>` pairs the registry in `root` holds, for a signal answer to name
 * (`readAuditAnswers`'s `clauses`); or why the registry cannot be read. `root` is the
 * checkout the plan lives in — its worktree while it has one — never the directory a
 * command was run from, since a plan's own promises are declared on its own branch.
 */
export function registryClauses(
	root: string,
): { ok: true; clauses: Set<string> } | { ok: false; why: string } {
	const registry = readPromises(root);
	if (!registry.ok) {
		return {
			ok: false,
			why: "missing" in registry ? `${registry.missing} is missing` : "an entry is malformed",
		};
	}
	return {
		ok: true,
		clauses: new Set(
			registry.registry.promises.flatMap((p) =>
				(p.clauses ?? []).map((c) => `${p.name}/${c.name}`),
			),
		),
	};
}
