import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * Defects 3, 4 and 6 from the workbench-blindness report.
 *
 * Shared root cause for 3 and 4: tooling resolves paths from "the project root",
 * which in a workbench is the wrapper — where there is no code. Defect 6 is a
 * packaging decision whose consequence is that any local fix to either is
 * silently reverted by the next `indusk update`.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function workbench(): { wb: string; repo: string } {
	root = mkdtempSync(join(tmpdir(), "blindness-"));
	const wb = join(root, "app-workbench");
	const repo = join(wb, "app");
	mkdirSync(join(wb, ".indusk"), { recursive: true });
	mkdirSync(repo, { recursive: true });
	writeFileSync(
		join(wb, ".indusk", "config.json"),
		JSON.stringify({
			mode: "local",
			worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "app" }] },
		}),
	);
	writeFileSync(join(repo, "package.json"), '{"name":"app","version":"0.0.0"}\n');
	git(repo, ["init", "-q", "-b", "main"]);
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-qm", "init"]);
	return { wb, repo };
}

describe("defect 6 — extension manifests are version-controllable", () => {
	it("ignores extension secrets, not extension manifests", () => {
		// `.indusk/extensions/` wholesale made every manifest untracked, so a
		// local fix had no diff, no history, and was replaced by `indusk update`
		// with no message. The revert was undetectable except by re-running the
		// check it affected — which is how it was found.
		root = mkdtempSync(join(tmpdir(), "ignore-"));
		git(root, ["init", "-q", "-b", "main"]);
		writeFileSync(join(root, "package.json"), '{"name":"x","version":"0.0.0"}\n');
		// FULL mode deliberately. `--local` excludes all of `.indusk/` per-clone,
		// which is the point of local mode — the defect only exists where
		// `.indusk/` is tracked and `extensions/` was singled out.
		expect(runCli(root, ["init", "--no-index"]).code).toBe(0);
		const ignore = readFileSync(join(root, ".gitignore"), "utf-8");
		expect(ignore, "the whole extensions dir must not be ignored").not.toMatch(
			/^\.indusk\/extensions\/$/m,
		);
		// Secrets still are — that was the legitimate half of the rule.
		expect(ignore).toMatch(/\.indusk\/extensions\/\*\/\.env/);
	});
});

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))(
	"defect 3 — init-docs scaffolds into the application repo",
	() => {
		it("does not create the docs site in the wrapper", { timeout: 90_000 }, () => {
			const { wb, repo } = workbench();
			const r = runCli(wb, ["init-docs"]);
			expect(r.code, `${r.stdout}${r.stderr}`).toBe(0);

			// The docs describe the application and must travel with it. A site in
			// the wrapper is orphaned the moment the app is cloned standalone.
			const inWrapper = existsSync(join(wb, "apps", "app-workbench-docs"));
			expect(inWrapper, "docs must not land in the wrapper").toBe(false);
			expect(existsSync(join(repo, "apps", "docs"))).toBe(true);
		});
	},
);

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))(
	"defect 4 — env-pull never reports success over a no-op",
	() => {
		it("fails when it wrote no files, instead of printing a count of zero", {
			timeout: 60_000,
		}, () => {
			// The observed failure: "doppler: auto-provisioned env for env-probe"
			// printed while zero files were written, so a developer saw a success
			// line and a worktree with no env. A check must distinguish "nothing to
			// do" from "did not run".
			const { wb } = workbench();
			mkdirSync(join(wb, ".indusk", "extensions", "doppler"), { recursive: true });
			writeFileSync(join(wb, ".indusk", "extensions", "doppler", ".env"), "DOPPLER_TOKEN=x\n");
			const cfg = JSON.parse(readFileSync(join(wb, ".indusk", "config.json"), "utf-8"));
			// A target that does not exist — the shape that used to write nothing
			// and say so cheerfully.
			cfg.doppler = { project: "nope", apps: [{ path: "does-not-exist", config: "api" }] };
			writeFileSync(join(wb, ".indusk", "config.json"), JSON.stringify(cfg, null, 2));

			const r = runCli(wb, ["doppler", "env-pull", "local"]);

			expect(r.code, "a pull that wrote nothing must not exit 0").not.toBe(0);
			expect(`${r.stdout}${r.stderr}`).toMatch(/wrote NO files|no files/i);
			expect(`${r.stdout}${r.stderr}`).not.toMatch(/wrote 0 file/);
		});
	},
);

describe("the extensions ignore block is normalized, negation last", () => {
	it("leaves manifest.local.json and .env.example trackable, .env ignored", () => {
		// Two bugs met here. The blanket `.indusk/extensions/` rule excluded the
		// directory, and git does not descend into an excluded directory, so every
		// file negation inside it was a dead letter — `.env.example` had never
		// been tracked on any machine. Then 1.39.0 appended `.env.*` AFTER the
		// existing negation, so even with the directory un-excluded the later rule
		// won. Order is the whole bug: a negation must follow what it negates.
		root = mkdtempSync(join(tmpdir(), "ignore-order-"));
		git(root, ["init", "-q", "-b", "main"]);
		mkdirSync(join(root, ".indusk", "extensions", "otel"), { recursive: true });
		writeFileSync(join(root, "package.json"), '{"name":"x","version":"0.0.0"}\n');
		writeFileSync(join(root, ".indusk", "config.json"), '{"mode":"full","verify":{}}\n');
		// A project carrying the pre-1.39 shape.
		writeFileSync(
			join(root, ".gitignore"),
			"# InDusk managed\n.indusk/extensions/\n.indusk/extensions/*/.env*\n!.indusk/extensions/*/.env.example\n",
		);
		// Valid JSON — a malformed override is a different test, below.
		writeFileSync(join(root, ".indusk", "extensions", "otel", "manifest.json"), "{}\n");
		writeFileSync(join(root, ".indusk", "extensions", "otel", "manifest.local.json"), "{}\n");
		writeFileSync(join(root, ".indusk", "extensions", "otel", ".env"), "X=1\n");
		writeFileSync(join(root, ".indusk", "extensions", "otel", ".env.example"), "X=\n");

		expect(runCli(root, ["update"]).code).toBe(0);

		const ignored = (f: string) =>
			git(root, ["check-ignore", "-q", `.indusk/extensions/otel/${f}`]).code === 0;

		expect(ignored("manifest.json"), "manifests are configuration").toBe(false);
		expect(ignored("manifest.local.json"), "the override must be committable").toBe(false);
		expect(ignored(".env.example"), "the example is documentation").toBe(false);
		expect(ignored(".env"), "secrets stay ignored").toBe(true);
	});
});

describe("a malformed override is loud but not catastrophic", () => {
	it("reports the file, keeps updating, and fails the exit code", () => {
		// Throwing all the way out took `indusk update` down with a stack trace
		// over one bad file, stopping every other extension from updating and
		// burying the message. Loud and specific, not catastrophic.
		root = mkdtempSync(join(tmpdir(), "bad-override-"));
		git(root, ["init", "-q", "-b", "main"]);
		mkdirSync(join(root, ".indusk", "extensions", "otel"), { recursive: true });
		writeFileSync(join(root, "package.json"), '{"name":"x","version":"0.0.0"}\n');
		writeFileSync(join(root, ".indusk", "config.json"), '{"mode":"full","verify":{}}\n');
		writeFileSync(join(root, ".indusk", "extensions", "otel", "manifest.json"), "{}\n");
		writeFileSync(join(root, ".indusk", "extensions", "otel", "manifest.local.json"), "{ not json");

		const r = runCli(root, ["update"]);
		const out = `${r.stdout}${r.stderr}`;

		expect(out, "names the file").toMatch(/manifest\.local\.json/);
		expect(out, "not a stack trace").not.toMatch(/at applyLocalOverride/);
		expect(r.code, "still fails, so it is not silent").not.toBe(0);
	});
});
