import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCreateTarget } from "../bin/commands/worktree.js";
import { CLI_BIN, git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * The legacy `wrapped_repo` workbench must be able to adopt a nested layout.
 *
 * `migrate-layout --apply` moves the worktrees and then declares where they
 * went, so the layout sticks. The declaration step read `cfg.worktree.repos`
 * — a key a legacy config does not have — so on exactly the workbenches this
 * migration exists for, the moves happened and nothing was recorded.
 *
 * Found by running it against a copy of numero-workbench's config shape, which
 * is the real migration target. Every fixture in the suite already used the
 * plural shape, so nothing covered the case the feature was built for.
 */

let root: string;

afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

/** A workbench declaring the SINGULAR `wrapped_repo`, with two worktrees. */
function buildLegacyWorkbench(): { wb: string; repo: string } {
	root = mkdtempSync(join(tmpdir(), "legacy-wb-"));
	const repo = join(root, "alpha");
	const wb = join(root, "alpha-workbench");
	mkdirSync(repo, { recursive: true });
	mkdirSync(join(wb, ".indusk"), { recursive: true });

	git(repo, ["init", "-q", "-b", "main"]);
	writeFileSync(join(repo, "a.md"), "x\n");
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-qm", "init"]);

	writeFileSync(
		join(wb, ".indusk", "config.json"),
		`${JSON.stringify(
			{
				mode: "local",
				worktree: { shape: "workbench", wrapped_repo: "alpha", sibling_parent: root },
			},
			null,
			2,
		)}\n`,
	);
	symlinkSync("../alpha", join(wb, "alpha"));
	git(repo, ["worktree", "add", "-q", join(wb, "feat-one"), "-b", "feat-one"]);
	git(repo, ["worktree", "add", "-q", join(wb, "feat-two"), "-b", "feat-two"]);
	return { wb, repo };
}

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))(
	"migrate-layout declares the layout on a legacy wrapped_repo workbench",
	() => {
		it("records where the worktrees went, so the move sticks", { timeout: 60_000 }, () => {
			const { wb } = buildLegacyWorkbench();

			const r = runCli(wb, ["workbench", "migrate-layout", "--apply"]);
			expect(r.code, `${r.stdout}${r.stderr}`).toBe(0);

			// The move itself was never the broken half.
			expect(existsSync(join(wb, "alpha-worktrees", "feat-one"))).toBe(true);
			expect(existsSync(join(wb, "alpha-worktrees", "feat-two"))).toBe(true);

			// The declaration is. Without it the next `worktree create` puts a
			// worktree back at the root and the cleanup silently undoes itself.
			const cfg = JSON.parse(readFileSync(join(wb, ".indusk", "config.json"), "utf-8"));
			const repos = cfg.worktree?.repos;
			expect(repos, "the singular config should have been materialized to repos[]").toBeDefined();
			expect(repos).toHaveLength(1);
			expect(repos[0].name).toBe("alpha");
			expect(repos[0].worktrees).toBe("alpha-worktrees");
		});

		it("lists the moved worktrees under their repo, not as unattributed", {
			timeout: 60_000,
		}, () => {
			// The user-visible consequence of the declaration landing.
			const { wb } = buildLegacyWorkbench();
			expect(runCli(wb, ["workbench", "migrate-layout", "--apply"]).code).toBe(0);

			const { stdout } = runCli(wb, ["worktree", "list"]);
			const unattributed = stdout.slice(stdout.indexOf("Unattributed"));
			expect(stdout).toMatch(/feat-one/);
			expect(stdout.includes("Unattributed") ? unattributed : "").not.toMatch(/feat-one/);
		});
	},
);

describe("resolveCreateTarget — which repo a create means", () => {
	const one = [{ name: "alpha" }];
	const two = [{ name: "alpha" }, { name: "beta" }];

	it("uses the only declared repo when none is named", () => {
		// The gap: on a single-repo workbench you type `worktree create my-slug`
		// with no repo, so nothing resolved the repo, so the declared worktrees
		// location was never passed and the worktree landed at the root.
		expect(resolveCreateTarget(one, ["my-slug"])).toEqual({ repo: "alpha", slug: "my-slug" });
	});

	it("still honors an explicitly named repo", () => {
		expect(resolveCreateTarget(two, ["beta", "my-slug"])).toEqual({
			repo: "beta",
			slug: "my-slug",
		});
	});

	it("refuses to guess when several are declared and none is named", () => {
		expect(resolveCreateTarget(two, ["my-slug"])).toEqual({ repo: undefined, slug: "my-slug" });
	});

	it("keeps a base branch, and does not mistake it for a repo", () => {
		expect(resolveCreateTarget(one, ["my-slug", "main"])).toEqual({
			repo: "alpha",
			slug: "my-slug",
			baseBranch: "main",
		});
	});
});
