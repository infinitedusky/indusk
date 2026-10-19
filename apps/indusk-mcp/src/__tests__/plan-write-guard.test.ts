// clause: a-plan-document-is-written-through-its-checks/shell-write-refused
// clause: a-plan-document-is-written-through-its-checks/reads-pass
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { refusalFor } from "../../hooks/plan-write-guard.js";
import { parserReadsWrite } from "../lib/promises/clause-verdicts.js";

/**
 * a-run-can-be-trusted, Build Phase 3: the shell guard's rule, imported as a pure
 * function over a command's text and the shell's working directory. The hook run as
 * a process is `plan-write-guard.contract.test.ts` (system tier).
 *
 * The root is a path that does not exist, so nothing here reads the disk: a name
 * with a dot directly under `.indusk/planning/` reads as a file (master.md), any
 * other name as a plan's folder.
 */

const ROOT = "/nonexistent-repo";
const PLAN = ".indusk/planning/some-plan";
const IMPL = `${PLAN}/impl.md`;
const refused = (command: string, cwd = ROOT) => refusalFor(command, cwd);

describe("A22 — a redirect or tee into a plan's impl.md is refused naming impl.md and the Edit tool", () => {
	it.each([
		`echo '- [x] done' > ${IMPL}`,
		`echo '- [x] done' >> ${IMPL}`,
		`echo x &> ${IMPL}`,
		`echo x >| ${IMPL}`,
		`echo x 1>> ${IMPL}`,
		`printf 'x' | tee ${IMPL}`,
		`printf 'x' | tee -a ${IMPL}`,
	])("%s", (command) => {
		const r = refused(command);
		expect(r).toMatch(/impl\.md/);
		expect(r).toMatch(/Edit tool/);
	});
});

describe("A23 — sed -i and perl -pi on a plan document are refused naming the file and the tool", () => {
	it.each([
		`sed -i 's/- \\[ \\]/- [x]/' ${IMPL}`,
		`sed -i '' 's/- \\[ \\]/- [x]/' ${IMPL}`,
		`sed -i.bak -e 's/a/b/' ${IMPL}`,
		`perl -pi -e 's/\\[ \\]/[x]/' ${IMPL}`,
		`perl -i -pe 's/a/b/' ${IMPL}`,
	])("%s", (command) => {
		const r = refused(command);
		expect(r).toMatch(/impl\.md/);
		expect(r).toMatch(/Edit tool/);
	});
});

describe("A24 — mv, cp, install into a plan's folder and rm, truncate of a plan document are refused", () => {
	it.each([
		[`mv /tmp/impl.md ${IMPL}`, /impl\.md/],
		[`cp /tmp/impl.md ${IMPL}`, /impl\.md/],
		[`cp /tmp/brief.md ${PLAN}/`, /some-plan/],
		[`install -m 644 /tmp/x ${PLAN}/x.md`, /x\.md/],
		[`rm ${IMPL}`, /impl\.md/],
		[`rm -f ${PLAN}/brief.md`, /brief\.md/],
		[`truncate -s 0 ${IMPL}`, /impl\.md/],
		[`mv ${IMPL} /tmp/impl.md`, /impl\.md/],
	])("%s", (command, file) => {
		expect(refused(command)).toMatch(file);
	});

	it("a mv of a whole plan folder names indusk plans archive", () => {
		const r = refused(`mv ${PLAN} .indusk/planning/archive/some-plan`);
		expect(r).toMatch(/indusk plans archive some-plan/);
	});

	it("a mv of a whole plan folder with a trailing slash names it too", () => {
		expect(refused(`mv ${PLAN}/ .indusk/planning/archive/`)).toMatch(/indusk plans archive/);
	});

	it("copying a plan document out of its folder is a read, not refused", () => {
		expect(refused(`cp ${IMPL} /tmp/impl-copy.md`)).toBeNull();
	});
});

describe("A25 — git mv, git rm, git checkout -- and git restore of a plan document are refused; git add and commit are not", () => {
	it.each([
		`git mv ${IMPL} ${PLAN}/impl-old.md`,
		`git rm ${IMPL}`,
		`git checkout -- ${IMPL}`,
		`git checkout HEAD~1 -- ${IMPL}`,
		`git restore ${IMPL}`,
		`git -C ${ROOT} restore --source=HEAD ${IMPL}`,
	])("%s is refused", (command) => {
		expect(refused(command)).toMatch(/impl\.md/);
	});

	it.each([
		`git add ${IMPL}`,
		`git commit -m "tick" ${IMPL}`,
		`git add ${IMPL} && git commit -m "a-run-can-be-trusted: tick ${IMPL}"`,
		`git restore --staged ${IMPL}`,
		`git rm --cached ${IMPL}`,
	])("%s is allowed", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A26 — an inline interpreter naming a plan path with a write call is refused; one naming none is not looked at", () => {
	it.each([
		`node -e "require('fs').writeFileSync('${IMPL}', 'x')"`,
		`node -e "fs.appendFileSync('${IMPL}', '- [x]')"`,
		`python -c "open('${IMPL}', 'w').write('x')"`,
		`pnpm exec tsx -e "import { writeFileSync } from 'node:fs'; writeFileSync('${IMPL}', '')"`,
	])("%s", (command) => {
		expect(refused(command)).toMatch(/impl\.md/);
	});

	it.each([
		`node -e "require('fs').writeFileSync('/tmp/out.txt', 'x')"`,
		`node -e "console.log(require('fs').readFileSync('${IMPL}', 'utf8'))"`,
		`python -c "print(open('${IMPL}').read())"`,
	])("%s is allowed", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A27 — the refusal covers a plan under archive/ and any document in the folder", () => {
	it.each(["brief.md", "test-plan.md", "adr.md", "impl.md", "plan-review.md", "retrospective.md"])(
		"%s of an active plan",
		(doc) => {
			expect(refused(`echo x >> ${PLAN}/${doc}`)).toMatch(new RegExp(doc.replace(".", "\\.")));
		},
	);

	it.each(["brief.md", "impl.md"])("%s of an archived plan", (doc) => {
		const r = refused(`sed -i 's/a/b/' .indusk/planning/archive/old-plan/${doc}`);
		expect(r).toMatch(new RegExp(`archive/old-plan/${doc.replace(".", "\\.")}`));
	});

	it("a file in a plan's subfolder", () => {
		expect(refused(`echo x > ${PLAN}/notes/one.md`)).toMatch(/one\.md/);
	});
});

describe("A28 — one write anywhere in a pipeline or && chain refuses the whole command", () => {
	it.each([
		`cat ${IMPL} && echo done >> ${IMPL}`,
		`grep -n x ${IMPL} | head -1; sed -i 's/a/b/' ${IMPL}`,
		`ls ${PLAN} || rm ${IMPL}`,
		`cat ${IMPL} | tee ${PLAN}/brief.md`,
	])("%s", (command) => {
		expect(refused(command)).toMatch(/\.md/);
	});
});

describe("A31 — indusk commands that change a plan document are not refused", () => {
	it.each([
		"indusk plans accept-brief some-plan",
		"indusk plans approve some-plan",
		"indusk promises declare a-thing --plan some-plan --kind behaviour",
		"indusk plans archive some-plan",
		`cd ${PLAN} && indusk plans approve some-plan`,
		"node apps/indusk-mcp/dist/bin/cli.js plans accept-brief some-plan",
		"INDUSK_GATE_POLICY=auto indusk plans approve some-plan",
	])("%s", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A32 — reads of a plan document are allowed", () => {
	it.each([
		`cat ${IMPL}`,
		`head -50 ${IMPL}`,
		`tail -n 20 ${IMPL}`,
		`sed -n '670,750p' ${IMPL}`,
		`grep -n "Build Phase 3" ${IMPL}`,
		`rg "A22" ${PLAN}`,
		`wc -l ${PLAN}/*.md`,
		`ls -la ${PLAN}`,
		`diff ${IMPL} /tmp/impl.md`,
		`git diff ${IMPL}`,
		`git log --oneline -- ${IMPL}`,
		`git show HEAD:${IMPL}`,
		"git status --porcelain",
		`git add ${IMPL}`,
		`git commit -m "tick" -- ${IMPL}`,
		`awk '/>/ { print }' ${IMPL}`,
		`find ${PLAN} -name '*.md'`,
		`cp -r ${PLAN} /tmp/plan-copy`,
	])("%s", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A33 — a plan path named only as text is allowed", () => {
	it.each([
		`git commit -m "fix ${IMPL}"`,
		`echo "see ${IMPL}" > /tmp/note`,
		`cat ${IMPL} > /tmp/copy`,
		`grep x ${IMPL} > /tmp/hits`,
		`git commit -m "$(cat <<'EOF'\nplan: tick ${IMPL} > done "quoted" it's\nEOF\n)"`,
		`echo '${IMPL} >> ${IMPL}'`,
	])("%s", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A34 — fd redirects and here-documents mentioning a plan path are not writes to it", () => {
	it.each([
		`grep x ${IMPL} 2>&1`,
		`cat ${IMPL} >/dev/null`,
		`cat ${IMPL} 2>/dev/null`,
		`cat ${IMPL} > /dev/null 2>&1`,
		`cat <<'EOF' > /tmp/body.md\necho x >> ${IMPL}\nrm ${IMPL}\nEOF`,
		`cat <<-EOF\n\tsed -i s/a/b/ ${IMPL}\n\tEOF`,
	])("%s", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A35 — writing outside plan folders is not refused", () => {
	it.each([
		"echo x > .claude/settings.local.json",
		"echo x >> apps/indusk-mcp/src/lib/x.ts",
		"echo x >> .indusk/current.md",
		"echo x > .indusk/planning/master.md",
		"sed -i 's/a/b/' .indusk/planning/CLAUDE.md",
		"rm -f .indusk/phase-boundary.jsonl",
		"mv /tmp/a /tmp/b",
	])("%s", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A75 — relative writes after cd into a plan folder, or with the shell inside one, are refused", () => {
	it("a write after cd into a plan folder", () => {
		expect(refused(`cd ${PLAN} && echo x >> impl.md`)).toMatch(/impl\.md/);
	});

	it("sed -i after cd into a plan folder", () => {
		expect(refused(`cd ${PLAN} && sed -i 's/a/b/' brief.md`)).toMatch(/brief\.md/);
	});

	it("a bare file name while the shell's working directory is a plan folder", () => {
		expect(refused("echo x > impl.md", `${ROOT}/${PLAN}`)).toMatch(/impl\.md/);
	});

	it("a relative write from the planning folder", () => {
		expect(refused("rm some-plan/impl.md", `${ROOT}/.indusk/planning`)).toMatch(/impl\.md/);
	});

	it("a read after cd into a plan folder is allowed", () => {
		expect(refused(`cd ${PLAN} && cat impl.md && sed -n 1,5p brief.md`)).toBeNull();
	});

	it("a git checkout of a branch from inside a plan folder is allowed", () => {
		expect(refused("git checkout main", `${ROOT}/${PLAN}`)).toBeNull();
	});
});

describe("A76 — bash -c and sh -c are read as commands; python3 -c, perl -i -pe, sed --in-place and find -delete are refused", () => {
	it.each([
		`bash -c "echo x >> ${IMPL}"`,
		`sh -c 'sed -i s/a/b/ ${IMPL}'`,
		`bash -lc "cd ${PLAN} && echo x > impl.md"`,
		`python3 -c "open('${IMPL}', 'a').write('x')"`,
		`perl -i -pe 's/a/b/' ${IMPL}`,
		`sed --in-place 's/a/b/' ${IMPL}`,
		`sed --in-place=.bak 's/a/b/' ${IMPL}`,
		`find ${PLAN} -name '*.md' -delete`,
		`find ${PLAN} -name impl.md -exec rm {} \\;`,
		`find .indusk/planning -name impl.md -exec sed -i s/a/b/ {} +`,
	])("%s", (command) => {
		expect(refused(command)).not.toBeNull();
	});

	it.each([`bash -c "cat ${IMPL}"`, `sh -c 'grep x ${IMPL} 2>&1'`])("%s is allowed", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("A77 — git apply and patch naming a plan path are refused; the git commands that move between committed states are allowed", () => {
	it.each([
		`git apply ${PLAN}/fix.patch`,
		`git apply --directory=${PLAN} /tmp/fix.patch`,
		`patch ${IMPL} /tmp/fix.patch`,
		`patch -p1 -i /tmp/fix.patch ${IMPL}`,
	])("%s is refused", (command) => {
		expect(refused(command)).not.toBeNull();
	});

	it.each([
		"git merge main",
		"git pull --rebase",
		"git checkout plan/some-plan",
		"git switch main",
		"git reset --hard HEAD~1",
		"git stash pop",
	])("%s is allowed", (command) => {
		expect(refused(command)).toBeNull();
	});
});

describe("a command the guard cannot parse is allowed (A29's rule, imported)", () => {
	it.each(["", "   ", "echo 'unclosed", 'echo "unclosed', "echo $(unclosed"])("%j", (command) => {
		expect(refused(command)).toBeNull();
	});
});

/**
 * A97, A98 (a-run-can-be-trusted, Build Phase 7, falsification): the shell writes the guard
 * let through on 2026-10-19 (one of them used by the audit session on this plan), and the reads
 * it refused. Each is judged by the guard, and the drain's independent reading
 * (`parserReadsWrite`) must read each the same way, so a refusal of a write still reports
 * `shell-write-refused` upheld and an allowed read `reads-pass` upheld.
 */
describe("A97 — the common shell writes it let through are refused naming the file", () => {
	let dir: string;
	let patchFile: string;
	let otherPatch: string;
	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "plan-write-guard-patch-"));
		patchFile = join(dir, "fix.patch");
		writeFileSync(
			patchFile,
			`diff --git a/${IMPL} b/${IMPL}\n--- a/${IMPL}\n+++ b/${IMPL}\n@@ -1 +1 @@\n-- [ ] x\n+- [x] x\n`,
		);
		otherPatch = join(dir, "other.patch");
		writeFileSync(
			otherPatch,
			"diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b\n",
		);
	});
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	const writes = () => [
		`perl -0pi -e 's/\\[ \\]/[x]/' ${IMPL}`,
		`perl -i.bak -pe 's/a/b/' ${IMPL}`,
		`python3 - <<'PY'\nopen('${IMPL}', 'a').write('- [x]')\nPY`,
		`python3 -I - <<'PY'\nfrom pathlib import Path\nPath('${PLAN}/audit.md').write_text('x')\nPY`,
		`node - <<'EOF'\nrequire('fs').appendFileSync('${IMPL}', 'x')\nEOF`,
		`bash <<EOF\necho x >> ${IMPL}\nEOF`,
		`python3 <<< "open('${IMPL}', 'w').write('x')"`,
		`node -e "require('fs').writeFileSync(process.argv[1], 'x')" ${IMPL}`,
		`F=${IMPL}; echo x >> $F`,
		`F=${IMPL} && sed -i 's/a/b/' "\${F}"`,
		`find ${PLAN} -name '*.md' | xargs sed -i 's/a/b/'`,
		`find .indusk/planning -name impl.md -print0 | xargs -0 rm`,
		`gsed -i 's/a/b/' ${IMPL}`,
		`awk -i inplace '{ print }' ${IMPL}`,
		`gawk -i inplace '{ print }' ${IMPL}`,
		`sort ${IMPL} | sponge ${IMPL}`,
		`printf '1d\\nw\\nq\\n' | ed -s ${IMPL}`,
		`ex -sc '%s/a/b/|x' ${IMPL}`,
		`vim -c '%s/a/b/' -c 'wq' ${IMPL}`,
		`nvim +'%s/a/b/' +wq ${IMPL}`,
		`curl -o ${IMPL} https://example.com/impl.md`,
		`curl -sSL --output ${IMPL} https://example.com/impl.md`,
		`wget -O ${IMPL} https://example.com/impl.md`,
		`wget --output-document=${IMPL} https://example.com/impl.md`,
		`tar -xf /tmp/plan.tar -C ${PLAN}`,
		`tar --directory=${PLAN} -xf /tmp/plan.tar`,
		`unzip -o /tmp/plan.zip -d ${PLAN}`,
		`git apply ${patchFile}`,
		`patch -p1 < ${patchFile}`,
		`patch -p1 -i ${patchFile}`,
	];

	it("each form is refused, naming a plan path", () => {
		for (const command of writes()) {
			const r = refused(command);
			expect(r, command).not.toBeNull();
			expect(r, command).toMatch(/some-plan|\.indusk\/planning/);
		}
	});

	it("the drain's shell parser reads each form as a write too", () => {
		for (const command of writes()) {
			expect(parserReadsWrite(command, ROOT), command).toBe(true);
		}
	});

	it("a patch whose headers name no plan path is not refused", () => {
		expect(refused(`git apply ${otherPatch}`)).toBeNull();
		expect(refused(`patch -p1 < ${otherPatch}`)).toBeNull();
	});
});

describe("A98 — reads an inline interpreter or a dry run makes are allowed", () => {
	const reads = [
		`node -e "process.stdout.write(require('fs').readFileSync('${IMPL}', 'utf8'))"`,
		`node -e "process.stderr.write(fs.readFileSync('${IMPL}'))"`,
		`python3 -c "import sys; sys.stdout.write(open('${IMPL}').read())"`,
		`python3 -c "import sys; sys.stderr.write(open('${IMPL}').read())"`,
	];

	it.each(reads)("%s is allowed", (command) => {
		expect(refused(command)).toBeNull();
		expect(parserReadsWrite(command, ROOT)).toBe(false);
	});

	it.each(["git clean -n", "git clean --dry-run", "git clean -nd"])(
		"%s in a plan folder is allowed",
		(command) => {
			expect(refused(command, `${ROOT}/${PLAN}`)).toBeNull();
			expect(parserReadsWrite(command, `${ROOT}/${PLAN}`)).toBe(false);
		},
	);

	it("a git clean that deletes in a plan folder is still refused", () => {
		expect(refused("git clean -fd", `${ROOT}/${PLAN}`)).not.toBeNull();
	});
});
