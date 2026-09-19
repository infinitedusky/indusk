/**
 * Edit one key of a markdown file's YAML frontmatter as text.
 *
 * `watch` rewrites promise and incident files that people also write by hand.
 * A gray-matter round trip would re-serialize every other key — it turns
 * `date: 2026-09-17` into an ISO timestamp (the writing-skill lesson) — so a
 * file `watch` touched would differ in lines nobody asked it to change, and a
 * second pass could never prove it changed nothing. These edits replace the
 * one key's lines in place and leave every other byte alone.
 */

interface Split {
	head: string[];
	body: string;
}

function split(text: string): Split {
	if (!text.startsWith("---\n")) throw new Error("frontmatter-edit: the file has no frontmatter");
	const end = text.indexOf("\n---", 4);
	if (end === -1) throw new Error("frontmatter-edit: the frontmatter is not closed");
	return { head: text.slice(4, end).split("\n"), body: text.slice(end) };
}

function join(s: Split): string {
	return `---\n${s.head.join("\n")}${s.body}`;
}

/** The index range [start, end) of `key`'s lines: the key line and any indented or list lines under it. */
function keyRange(head: string[], key: string): [number, number] | null {
	const start = head.findIndex((l) => l.startsWith(`${key}:`));
	if (start === -1) return null;
	let end = start + 1;
	while (end < head.length && /^(\s+|-\s)/.test(head[end])) end++;
	return [start, end];
}

function replaceKey(text: string, key: string, lines: string[]): string {
	const s = split(text);
	const range = keyRange(s.head, key);
	if (range) s.head.splice(range[0], range[1] - range[0], ...lines);
	else s.head.push(...lines);
	return join(s);
}

function quote(value: string): string {
	return /^[\w./@-]+$/.test(value) && !/^\d/.test(value) ? value : `'${value.replace(/'/g, "''")}'`;
}

/** Set a scalar key (added at the end of the frontmatter when absent). */
export function setScalar(text: string, key: string, value: string): string {
	return replaceKey(text, key, [`${key}: ${quote(value)}`]);
}

/** Set a list key, written as a block list (`[]` when empty). */
export function setList(text: string, key: string, values: string[]): string {
	return replaceKey(
		text,
		key,
		values.length === 0 ? [`${key}: []`] : [`${key}:`, ...values.map((v) => `  - ${quote(v)}`)],
	);
}
