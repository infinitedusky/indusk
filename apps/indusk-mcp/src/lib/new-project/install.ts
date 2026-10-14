import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { induskMcpPackageRoot } from "../package-root.js";

/**
 * What `indusk init` really left in a project (new-project-flow Build Phase 7):
 * the skills, the hooks and the MCP entry the package ships. `init` swallows a
 * sub-step that fails - `claude mcp add` with no `claude` on the path, a hook
 * that could not be copied - and exits 0, so its exit code proves it ran, not
 * that InDusk is there. Creation reads the project afterwards and fails the
 * install step, which removes what the run made, when anything is missing; the
 * same reading is the project's own check that it is installed.
 *
 * promise: a-new-project-has-the-standard-layout
 */

const readJson = (path: string): unknown => {
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
};

const namesIn = (dir: string, extension: string): string[] =>
	existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(extension)) : [];

/** One line per piece of the install missing from `root`; none when InDusk is installed. */
export function installProblems(root: string): string[] {
	const shipped = induskMcpPackageRoot();
	const problems: string[] = [];

	for (const file of namesIn(join(shipped, "skills"), ".md")) {
		const skill = file.slice(0, -".md".length);
		if (!existsSync(join(root, ".claude", "skills", skill, "SKILL.md"))) {
			problems.push(`the ${skill} skill is missing (.claude/skills/${skill}/SKILL.md)`);
		}
	}
	for (const file of namesIn(join(shipped, "hooks"), ".js")) {
		if (!existsSync(join(root, ".claude", "hooks", file))) {
			problems.push(`the ${file} hook is missing (.claude/hooks/${file})`);
		}
	}
	const settings = readJson(join(root, ".claude", "settings.json")) as {
		hooks?: { PreToolUse?: unknown[] };
	} | null;
	if (!settings?.hooks?.PreToolUse?.length) {
		problems.push("no hook is registered (.claude/settings.json has no PreToolUse hooks)");
	}
	const mcp = readJson(join(root, ".mcp.json")) as { mcpServers?: Record<string, unknown> } | null;
	if (!mcp?.mcpServers?.indusk) {
		problems.push(
			"the indusk MCP server is not registered (.mcp.json has no indusk entry; `claude mcp add` may have failed)",
		);
	}
	return problems;
}
