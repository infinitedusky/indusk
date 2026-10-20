// clause: admin-pages-load-fast/never-freezes
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contractDir, readPromises, readPromisesKept } from "./registry";

const promise = (name: string, statement: string) =>
	`---\nname: ${name}\nkind: behaviour\nstate: declared\ndomain: test\nowner: some-plan\n---\n\n${statement}\n`;

function project(): {
	root: string;
	write: (name: string, statement: string, ageSec: number) => void;
} {
	const root = mkdtempSync(join(tmpdir(), "registry-kept-"));
	const dir = contractDir(root);
	mkdirSync(dir, { recursive: true });
	return {
		root,
		write(name, statement, ageSec) {
			const file = join(dir, `${name}.md`);
			writeFileSync(file, promise(name, statement));
			const t = new Date(Date.now() - ageSec * 1000);
			utimesSync(file, t, t);
		},
	};
}

/**
 * Every plan on an admin page asked for the registry again; the kept reading is
 * the same answer as a fresh one, and a changed file is never answered stale.
 */
describe("the promise registry kept while no file changes", () => {
	it("answers the same as a fresh read, and reuses the reading while files are unchanged", () => {
		const p = project();
		p.write("one", "First.", 60);
		const first = readPromisesKept(p.root);
		expect(first).toEqual(readPromises(p.root));
		expect(readPromisesKept(p.root)).toBe(first);
	});

	it("reads again when a file changes, even to the same size", () => {
		const p = project();
		p.write("one", "First.", 60);
		const first = readPromisesKept(p.root);
		p.write("one", "Other.", 30);
		const second = readPromisesKept(p.root);
		expect(second).not.toBe(first);
		expect(second).toEqual(readPromises(p.root));
	});

	it("never keeps a reading of a file modified in the last two seconds", () => {
		const p = project();
		p.write("one", "First.", 0);
		const first = readPromisesKept(p.root);
		expect(readPromisesKept(p.root)).not.toBe(first);
	});
});
