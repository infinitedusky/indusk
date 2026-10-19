#!/usr/bin/env node
/**
 * PreToolUse hook (Bash only): a shell command that writes a plan document is refused.
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 * clause: a-plan-document-is-written-through-its-checks/reads-pass
 *
 * A plan document (any file under `.indusk/planning/<plan>/`, or
 * `.indusk/planning/archive/<plan>/`) is written through the Edit tool, whose
 * checks (`check-gates.js`, `validate-impl-structure.js`) guard it, or through
 * the `indusk` command for it. A shell write goes around those checks: a build
 * session once ticked a phase off with `sed -i` while an amendment waited. So
 * this hook reads each shell command's text and refuses one that writes,
 * moves or deletes a file in a plan's folder, naming the file and the tool to
 * use instead.
 *
 * Refused, in any segment of a chain or pipeline, after any `cd`, inside
 * `bash -c` / `sh -c` text and `$(…)`: a redirect (`>`, `>>`, `>|`, `&>`) onto
 * a plan path; `tee`; `sed -i` / `--in-place`; `perl -i`; `mv`; `cp`,
 * `install`, `rsync`, `ln` into a plan folder; `rm`, `rmdir`, `unlink`,
 * `truncate`, `shred`, `touch`; `dd of=`; `find` over a plan path with
 * `-delete` or `-exec rm|mv|sed -i …`; `git mv|rm|restore|apply|clean`,
 * `git checkout [<tree>] -- <path>`; `patch`; and inline interpreter text
 * (`node -e`, `python -c`, `perl -e`, `ruby -e`, `tsx -e`) that names a plan
 * path, or runs inside a plan folder, with a write call. A `mv` of a whole plan
 * folder names `indusk plans archive <plan>`.
 *
 * Never refused: a read, a plan path named only as text (a commit message, an
 * `echo` to a file elsewhere, a here-document's body), an fd redirect
 * (`2>&1`, `>/dev/null`), an `indusk` command (it writes through the checks
 * itself), and the git commands that move a checkout between committed states
 * (`merge`, `pull`, `checkout <branch>`, `switch`, `reset --hard`,
 * `stash pop`). A command the guard cannot parse is allowed: a hook that
 * refuses what it cannot read would block every shell command it misreads.
 *
 * It reads command text, never a script's body: a script file that builds a
 * plan path at run time passes it (U1). It is a tripwire for an agent's
 * ordinary attempt, as `looks-approval-guard.js` is. What sees past it is the
 * record: each decision is written to machine state with the plan folders'
 * state before the command (`_clause-verdicts.js`), `plan-write-witness.js`
 * writes their state after, and the package judges both
 * (`lib/promises/clause-verdicts.ts`). The hook writes no verdict on itself.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	appendDecision,
	PENDING_DIR,
	planFolderSnapshot,
	planRootOf,
	toolUseKey,
} from "./_clause-verdicts.js";
import { projectHome } from "./_hook-paths.js";

/** A plan path named anywhere in a piece of text: `.indusk/planning/[archive/]<plan>/…`. */
const PLAN_IN_TEXT = /\.indusk[\\/]planning[\\/](?:archive[\\/])?[\w*-][^\s'"`\\/]*[\\/]/;

/** A call that writes a file, in any of the interpreters the guard reads. */
const WRITE_CALL = new RegExp(
	[
		"\\b(?:writeFile|appendFile|createWriteStream|copyFile|cpSync|rmSync|rmdirSync|unlink|rename|truncate|symlink|linkSync)",
		"\\bfs\\.(?:rm|cp|writev?|promises)\\b",
		"\\bopen\\s*\\([^)]*,\\s*['\"]?[wax+]",
		"\\.write(?:_text|_bytes|lines)?\\s*\\(",
		"\\b(?:shutil\\.\\w+|os\\.(?:remove|rename|replace|unlink|rmdir|makedirs))",
		"\\b(?:File|IO)\\.(?:write|open|delete|rename)",
		"\\bopen\\s*\\(?[^;)]*['\"]\\s*\\+?>",
		"\\b(?:unlink|rename|truncate|sysopen)\\b",
	].join("|"),
);

/** A write to standard output or standard error: a read printed, never a file written (A98). */
const STD_STREAM_WRITE = /\b(?:process\.(?:stdout|stderr)|sys\.(?:stdout|stderr))\.write\s*\(/g;

/** Whether interpreter text writes a file: a write call, standard-stream writes left out. */
const writesFile = (text) => WRITE_CALL.test(text.replace(STD_STREAM_WRITE, ""));

const INTERPRETERS = new Set(["node", "python", "python3", "perl", "ruby", "deno", "bun", "tsx"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const INDUSK_BINS = new Set(["indusk", "atdawn", "dev-system"]);
/** Commands whose every path argument is written (or removed). */
const REMOVERS = new Set(["rm", "rmdir", "unlink", "truncate", "shred", "touch"]);
/** Commands that write only their destination. */
const COPIERS = new Set(["cp", "install", "rsync", "ln"]);
/** Editors that write the files they are given, whatever their flags. */
const FILE_EDITORS = new Set(["sponge", "ed", "ex"]);
/** Editors that write the files they are given when told what to run (`-c`, `+cmd`, `-s`, `-e`). */
const SCREEN_EDITORS = new Set(["vim", "vi", "nvim", "view"]);
/** A sed in-place flag (`-i`, `-i.bak`, `-Ei`); perl's allows its digit switches (`-0pi`, `-0777pi`), never `-I`. */
const SED_IN_PLACE = /^-[a-zA-Z]*i/;
const PERL_IN_PLACE = /^-(?:0[0-7]*|[a-hj-zA-HJ-Z])*i/;
const inPlaceFlag = (verb, a) =>
	a.startsWith("--in-place") || (verb === "perl" ? PERL_IN_PLACE : SED_IN_PLACE).test(a);
/** Words that run the command after them. */
const WRAPPERS = new Set([
	"sudo",
	"command",
	"builtin",
	"exec",
	"nohup",
	"time",
	"then",
	"do",
	"else",
	"!",
	"{",
	"}",
	"if",
	"while",
	"until",
]);

// ─── lexing ────────────────────────────────────────────────────────────────

class Unparsable extends Error {}

const REDIRECT_OPS = [">>", ">|", ">&", "<<<", "<<-", "<<", "<&", "<>", ">", "<"];

/**
 * Lex shell text from `i` into tokens: `{ t: "w", v }` (a word, quotes
 * removed), `{ t: "sep", v }` (`&&`, `||`, `;`, `|`, `&`, newline, `(`, `)`)
 * and `{ t: "redir", v, fd }`. A here-document's body is skipped. Each
 * `$(…)` and backtick substitution is lexed too, and its tokens returned in
 * `subs`, so a write inside one is judged. With `inSubst`, stops at the `)`
 * that closes the substitution and returns its index in `end`.
 * Throws `Unparsable` on an unclosed quote or substitution.
 */
function lex(text, start = 0, inSubst = false) {
	const tokens = [];
	const subs = [];
	const heredocs = [];
	let word = null;
	let depth = 0;
	let expectDelim = null;
	let i = start;

	let heredocTok = null;
	const push = (t) => {
		if (expectDelim && t.t === "w") {
			heredocs.push({ delim: t.v, strip: expectDelim === "<<-", tok: heredocTok });
			expectDelim = null;
			heredocTok = null;
			tokens.push(t);
			return;
		}
		tokens.push(t);
	};
	const endWord = () => {
		if (word !== null) push({ t: "w", v: word });
		word = null;
	};
	const add = (s) => {
		word = (word ?? "") + s;
	};
	const readSubst = (from) => {
		const inner = lex(text, from, true);
		subs.push(inner.tokens, ...inner.subs);
		return inner.end;
	};
	const skipHeredocs = (nl) => {
		// `nl` is the newline ending the line the operators were on.
		let pos = nl + 1;
		for (const doc of heredocs) {
			const body = [];
			for (;;) {
				if (pos >= text.length) break;
				const eol = text.indexOf("\n", pos);
				const line = text.slice(pos, eol === -1 ? text.length : eol);
				pos = eol === -1 ? text.length : eol + 1;
				if ((doc.strip ? line.replace(/^\t+/, "") : line) === doc.delim) break;
				body.push(doc.strip ? line.replace(/^\t+/, "") : line);
			}
			// The body is kept on its redirect: an interpreter reading it is judged on it.
			if (doc.tok) doc.tok.body = body.join("\n");
		}
		heredocs.length = 0;
		return pos - 1; // the loop's i++ lands on the first line after the bodies
	};

	while (i < text.length) {
		const c = text[i];
		if (c === "\\") {
			if (text[i + 1] === "\n") {
				i += 2;
				continue;
			}
			add(text[i + 1] ?? "");
			i += 2;
			continue;
		}
		if (c === "'") {
			const close = text.indexOf("'", i + 1);
			if (close === -1) throw new Unparsable("unclosed '");
			add(text.slice(i + 1, close));
			i = close + 1;
			continue;
		}
		if (c === '"') {
			let j = i + 1;
			let s = "";
			for (;;) {
				if (j >= text.length) throw new Unparsable('unclosed "');
				const d = text[j];
				if (d === '"') break;
				if (d === "\\" && j + 1 < text.length) {
					s += text[j + 1];
					j += 2;
					continue;
				}
				if (d === "$" && text[j + 1] === "(") {
					const end = readSubst(j + 2);
					s += text.slice(j, end + 1);
					j = end + 1;
					continue;
				}
				if (d === "`") {
					const close = text.indexOf("`", j + 1);
					if (close === -1) throw new Unparsable("unclosed `");
					subs.push(lex(text.slice(j + 1, close)).tokens);
					s += text.slice(j, close + 1);
					j = close + 1;
					continue;
				}
				s += d;
				j++;
			}
			add(s);
			i = j + 1;
			continue;
		}
		if (c === "$" && text[i + 1] === "(") {
			const end = readSubst(i + 2);
			add(text.slice(i, end + 1));
			i = end + 1;
			continue;
		}
		if (c === "`") {
			const close = text.indexOf("`", i + 1);
			if (close === -1) throw new Unparsable("unclosed `");
			subs.push(lex(text.slice(i + 1, close)).tokens);
			add(text.slice(i, close + 1));
			i = close + 1;
			continue;
		}
		if (c === "#" && word === null) {
			const eol = text.indexOf("\n", i);
			i = eol === -1 ? text.length : eol;
			continue;
		}
		if (c === " " || c === "\t") {
			endWord();
			i++;
			continue;
		}
		if (c === "\n") {
			endWord();
			push({ t: "sep", v: "\n" });
			i = heredocs.length > 0 ? skipHeredocs(i) + 1 : i + 1;
			continue;
		}
		if (c === "(") {
			endWord();
			depth++;
			push({ t: "sep", v: "(" });
			i++;
			continue;
		}
		if (c === ")") {
			endWord();
			if (inSubst && depth === 0) return { tokens, subs, end: i };
			depth = Math.max(0, depth - 1);
			push({ t: "sep", v: ")" });
			i++;
			continue;
		}
		if (c === "&" && text[i + 1] === ">") {
			endWord();
			const append = text[i + 2] === ">";
			push({ t: "redir", v: append ? "&>>" : "&>", fd: "&" });
			i += append ? 3 : 2;
			continue;
		}
		if (c === "&" || c === "|" || c === ";") {
			endWord();
			const two = text.slice(i, i + 2);
			const op = ["&&", "||", "|&", ";;"].includes(two) ? two : c;
			push({ t: "sep", v: op });
			i += op.length;
			continue;
		}
		if (c === ">" || c === "<") {
			let fd = null;
			if (word !== null && /^\d+$/.test(word)) {
				fd = word;
				word = null;
			}
			endWord();
			const op = REDIRECT_OPS.find((o) => text.startsWith(o, i));
			const tok = { t: "redir", v: op, fd };
			if (op === "<<" || op === "<<-") {
				expectDelim = op;
				heredocTok = tok;
			}
			push(tok);
			i += op.length;
			continue;
		}
		add(c);
		i++;
	}
	if (inSubst) throw new Unparsable("unclosed $(");
	endWord();
	return { tokens, subs, end: i };
}

/**
 * Tokens → segments: `{ words, redirects: [{ op, fd, target, body? }], sep }`, where `sep`
 * is the separator before the segment (`|` joins it to the one before in a pipeline) and a
 * here-document's redirect carries its `body`.
 */
function segmentsOf(tokens) {
	const out = [];
	let sep = null;
	let cur = { words: [], redirects: [], sep };
	for (let k = 0; k < tokens.length; k++) {
		const tok = tokens[k];
		if (tok.t === "sep") {
			if (cur.words.length || cur.redirects.length) out.push(cur);
			sep = tok.v;
			cur = { words: [], redirects: [], sep };
		} else if (tok.t === "redir") {
			const next = tokens[k + 1];
			const target = next?.t === "w" ? next.v : "";
			if (next?.t === "w") k++;
			cur.redirects.push({
				op: tok.v,
				fd: tok.fd,
				target,
				...(tok.body === undefined ? {} : { body: tok.body }),
			});
		} else {
			cur.words.push(tok.v);
		}
	}
	if (cur.words.length || cur.redirects.length) out.push(cur);
	return out;
}

// ─── paths ─────────────────────────────────────────────────────────────────

function expandHome(word) {
	if (word === "~") return homedir();
	if (word.startsWith("~/")) return resolve(homedir(), word.slice(2));
	return word;
}

function abs(word, cwd) {
	const w = expandHome(word);
	return isAbsolute(w) ? resolve(w) : resolve(cwd, w);
}

/**
 * What a path is under `.indusk/planning/`: `{ plan, archived, folder }` for a
 * plan's folder or anything in it, null otherwise. A name directly under the
 * planning folder is a plan when it is a directory on disk, or, not on disk,
 * when it has no dot (`master.md` and `CLAUDE.md` are not plans).
 */
export function planPathOf(path) {
	const norm = path.replace(/\\/g, "/");
	const m = /(?:^|\/)\.indusk\/planning\/(.*)$/.exec(norm);
	if (!m) return null;
	const parts = m[1].split("/").filter(Boolean);
	let archived = false;
	if (parts[0] === "archive") {
		archived = true;
		parts.shift();
	}
	if (parts.length === 0) return null;
	const [plan, ...rest] = parts;
	if (rest.length === 0) {
		let isDir;
		try {
			isDir = existsSync(path) ? statSync(path).isDirectory() : !plan.includes(".");
		} catch {
			isDir = !plan.includes(".");
		}
		if (!isDir) return null;
	}
	return { plan, archived, folder: rest.length === 0 };
}

/** The planning folder itself, or the archive: a recursive delete or move of it takes plans with it. */
function holdsPlans(path) {
	return /(?:^|\/)\.indusk(?:\/planning(?:\/archive)?)?\/?$/.test(path.replace(/\\/g, "/"));
}

// ─── judging ───────────────────────────────────────────────────────────────

/** Strip leading `VAR=value`s and wrapper words; returns the words from the command on. */
function commandWords(words) {
	const w = [...words];
	for (;;) {
		if (w.length === 0) return w;
		const first = w[0];
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(first) || WRAPPERS.has(first)) {
			w.shift();
			continue;
		}
		const name = basename(first);
		if (name === "env") {
			w.shift();
			while (w.length && (w[0].startsWith("-") || /^[A-Za-z_]\w*=/.test(w[0]))) w.shift();
			continue;
		}
		if (name === "nice" || name === "timeout" || name === "stdbuf" || name === "xargs") {
			w.shift();
			while (w.length && (w[0].startsWith("-") || /^\d+[smhd]?$/.test(w[0]))) w.shift();
			continue;
		}
		if (name === "npx" || name === "bunx") {
			w.shift();
			while (w.length && w[0].startsWith("-")) w.shift();
			continue;
		}
		if (name === "pnpm" || name === "yarn" || name === "npm") {
			const exec = w.findIndex((x) => x === "exec" || x === "dlx");
			if (exec === -1) return w;
			w.splice(0, exec + 1);
			while (w.length && w[0].startsWith("-")) w.shift();
			continue;
		}
		return w;
	}
}

/**
 * The files `sed` or `perl` edits: its non-flag arguments, less the script —
 * the value after `-e` / `-f` (sed) or a flag ending in `e` (perl), else the
 * first non-flag argument.
 */
function editedFiles(verb, args) {
	const files = [];
	let scriptGiven = false;
	for (let k = 0; k < args.length; k++) {
		const a = args[k];
		const takesScript =
			verb === "sed"
				? a === "-e" || a === "-f" || a === "--expression" || a === "--file"
				: /^-[a-zA-Z]*e$/.test(a);
		if (takesScript) {
			scriptGiven = true;
			k++;
			continue;
		}
		if (verb === "sed" && (a.startsWith("--expression=") || a.startsWith("--file="))) {
			scriptGiven = true;
			continue;
		}
		if (a !== "" && !a.startsWith("-")) files.push(a);
	}
	return scriptGiven ? files : files.slice(1);
}

const flagValue = (a) => (a.includes("=") ? a.slice(a.indexOf("=") + 1) : null);
const nonFlags = (args) => args.filter((a) => a !== "" && !a.startsWith("-"));

/**
 * Judge one segment at `cwd`. Returns `{ refusal?, cwd? }`: a refusal names
 * the file; a `cd` returns the new working directory.
 */
function judgeSegment(seg, ctx) {
	const { cwd } = ctx;
	const planAt = (word, at = cwd) => {
		if (!word) return null;
		const p = abs(word, at);
		const hit = planPathOf(p);
		if (hit) ctx.files.add(p);
		return hit ? { path: p, ...hit } : null;
	};
	const stdinText = seg.redirects
		.filter((r) => r.body !== undefined || r.op === "<<<")
		.map((r) => (r.op === "<<<" ? r.target : r.body))
		.join("\n");

	for (const r of seg.redirects) {
		const writes = [">", ">>", ">|", "&>", "&>>", "<>"].includes(r.op);
		const dupToFile = r.op === ">&" && !/^(\d+|-)$/.test(r.target);
		if (!writes && !dupToFile) continue;
		const hit = planAt(r.target);
		if (hit) return { refusal: documentRefusal(hit.path, ctx) };
	}

	const words = commandWords(seg.words);
	if (words.length === 0) return {};
	const verb = basename(words[0]);
	const args = words.slice(1);
	// Every plan path the segment names is recorded, read or write, for the package's judgement;
	// the first one, or a folder that holds plans, is what a later `xargs` in the pipeline gets.
	let names = null;
	for (const a of args) {
		if (a.startsWith("-")) continue;
		const hit = planAt(a);
		if (!names && (hit || holdsPlans(abs(a, cwd)))) names = abs(a, cwd);
	}
	const viaXargs = seg.words
		.slice(0, seg.words.length - words.length)
		.some((w) => basename(w) === "xargs");
	if (viaXargs && ctx.pipeSource) {
		const writer =
			REMOVERS.has(verb) ||
			COPIERS.has(verb) ||
			FILE_EDITORS.has(verb) ||
			verb === "mv" ||
			verb === "tee" ||
			((verb === "sed" || verb === "gsed" || verb === "perl") &&
				args.some((a) => inPlaceFlag(verb, a)));
		if (writer) return { refusal: documentRefusal(ctx.pipeSource, ctx), names };
	}
	const r = judgeVerb(verb, args, seg, ctx, planAt, stdinText);
	return { ...r, names };
}

/** Judge one simple command by its verb (`judgeSegment` has read its redirects). */
function judgeVerb(verb, args, seg, ctx, planAt, stdinText) {
	const { cwd } = ctx;

	if (verb === "cd" || verb === "pushd") {
		const target = args.find((a) => !a.startsWith("-"));
		if (!target) return { cwd: homedir() };
		return { cwd: abs(target, cwd) };
	}
	if (INDUSK_BINS.has(verb)) return {};
	if (verb === "node" && nonFlags(args)[0]?.endsWith("bin/cli.js")) return {};

	const firstPlan = (list, at) => {
		for (const a of list) {
			const hit = planAt(a, at);
			if (hit) return hit;
		}
		return null;
	};
	const refuse = (hit) => ({ refusal: documentRefusal(hit.path, ctx) });

	if (verb === "tee" || FILE_EDITORS.has(verb)) {
		const hit = firstPlan(nonFlags(args));
		return hit ? refuse(hit) : {};
	}
	if (SCREEN_EDITORS.has(verb)) {
		const scripted = args.some(
			(a) => a.startsWith("+") || ["-c", "--cmd", "-s", "-e", "-es", "-Es"].includes(a),
		);
		const hit = scripted ? firstPlan(nonFlags(args)) : null;
		return hit ? refuse(hit) : {};
	}
	if (verb === "sed" || verb === "gsed" || verb === "perl") {
		const inPlace = args.some((a) => inPlaceFlag(verb, a));
		if (inPlace) {
			const hit = firstPlan(editedFiles(verb === "gsed" ? "sed" : verb, args));
			if (hit) return refuse(hit);
		}
		if (verb !== "perl") return {};
	}
	if (verb === "awk" || verb === "gawk") {
		const inPlace = args.some(
			(a, k) =>
				a === "-iinplace" ||
				a === "--include=inplace" ||
				((a === "-i" || a === "--include") && args[k + 1] === "inplace"),
		);
		const hit = inPlace ? firstPlan(nonFlags(args).filter((a) => a !== "inplace")) : null;
		return hit ? refuse(hit) : {};
	}
	if (verb === "curl" || verb === "wget") {
		const out =
			verb === "curl"
				? optionValue(args, (a) => /^-[a-zA-Z]*o$/.test(a) || a === "--output", "--output=")
				: optionValue(
						args,
						(a) =>
							a === "-O" || a === "--output-document" || a === "-P" || a === "--directory-prefix",
						"--output-document=",
						"--directory-prefix=",
					);
		const hit = out.map((v) => planAt(v)).find(Boolean);
		return hit ? refuse(hit) : {};
	}
	if (verb === "tar") {
		const extracting = args.some(
			(a, k) =>
				a === "--extract" ||
				a === "--get" ||
				/^-[a-zA-Z]*x/.test(a) ||
				(k === 0 && /^[a-zA-Z]*x[a-zA-Z]*$/.test(a)),
		);
		const into = optionValue(args, (a) => a === "-C" || a === "--directory", "--directory=");
		const hit = extracting ? into.map((v) => planAt(v)).find(Boolean) : null;
		return hit ? refuse(hit) : {};
	}
	if (verb === "unzip") {
		const hit = optionValue(args, (a) => a === "-d")
			.map((v) => planAt(v))
			.find(Boolean);
		return hit ? refuse(hit) : {};
	}
	if (verb === "mv") {
		const paths = nonFlags(args);
		for (const a of paths) {
			const p = abs(a, cwd);
			const hit = planAt(a);
			if (hit?.folder) return { refusal: folderRefusal(p, hit, ctx) };
			if (hit) return refuse(hit);
			if (holdsPlans(p)) return { refusal: documentRefusal(p, ctx) };
		}
		return {};
	}
	if (COPIERS.has(verb)) {
		const t = args.indexOf("-t");
		const dest = t !== -1 ? args[t + 1] : nonFlags(args).at(-1);
		const hit = planAt(dest);
		return hit ? refuse(hit) : {};
	}
	if (REMOVERS.has(verb)) {
		for (const a of nonFlags(args)) {
			const hit = planAt(a);
			if (hit) return refuse(hit);
			if (verb === "rm" && holdsPlans(abs(a, cwd)))
				return { refusal: documentRefusal(abs(a, cwd), ctx) };
		}
		return {};
	}
	if (verb === "dd") {
		const of = args.find((a) => a.startsWith("of="));
		const hit = of ? planAt(of.slice(3)) : null;
		return hit ? refuse(hit) : {};
	}
	if (verb === "find") return judgeFind(args, ctx, planAt, refuse);
	if (verb === "git") return judgeGit(args, ctx, planAt, refuse);
	if (verb === "patch") {
		for (const a of args) {
			const hit = planAt(flagValue(a) ?? a);
			if (hit) return refuse(hit);
		}
		const patches = [
			...optionValue(args, (a) => a === "-i" || a === "--input", "--input="),
			...seg.redirects.filter((r) => r.op === "<").map((r) => r.target),
			...nonFlags(args),
		];
		const hit = patchedPlanPath(patches, cwd, planAt);
		return hit ? refuse(hit) : {};
	}
	if (SHELLS.has(verb)) {
		const c = args.findIndex((a) => /^-[a-z]*c$/.test(a));
		if (c !== -1 && typeof args[c + 1] === "string") return judgeText(args[c + 1], ctx);
		// No script named (or `-s`): the shell runs what it reads, a here-document or here-string.
		const script = args.find((a) => !a.startsWith("-"));
		if (script === undefined && stdinText !== "") {
			const saved = ctx.cwd;
			const r = judgeText(stdinText, ctx);
			ctx.cwd = saved;
			return r;
		}
		return {};
	}
	if (verb === "eval") return judgeText(args.join(" "), ctx);
	if (INTERPRETERS.has(verb)) return judgeInline(verb, args, ctx, planAt, stdinText);
	return {};
}

/** Every value an option takes: the word after a matching flag, or the text after `prefix=`. */
function optionValue(args, isFlag, ...prefixes) {
	const out = [];
	for (let k = 0; k < args.length; k++) {
		const a = args[k];
		const prefixed = prefixes.find((p) => a.startsWith(p));
		if (prefixed) out.push(a.slice(prefixed.length));
		else if (isFlag(a) && typeof args[k + 1] === "string") out.push(args[++k]);
	}
	return out;
}

/** The largest patch file read for its headers; a bigger one is not looked into. */
const PATCH_MAX_BYTES = 1024 * 1024;

/**
 * The first plan path a patch file's headers name (`diff --git a/… b/…`, `--- …`, `+++ …`, an
 * `a/` or `b/` prefix taken off), among the files given that exist; null when none does.
 */
function patchedPlanPath(files, at, planAt) {
	for (const f of files) {
		const path = abs(f, at);
		let text;
		try {
			const st = statSync(path);
			if (!st.isFile() || st.size > PATCH_MAX_BYTES) continue;
			text = readFileSync(path, "utf-8");
		} catch {
			continue;
		}
		for (const line of text.split("\n")) {
			const git = /^diff --git a\/(\S+) b\/(\S+)/.exec(line);
			const named = git ? [git[1], git[2]] : [];
			const unified = /^(?:---|\+\+\+) (\S+)/.exec(line);
			if (unified && unified[1] !== "/dev/null") named.push(unified[1].replace(/^[ab]\//, ""));
			for (const n of named) {
				const hit = planAt(n, at);
				if (hit) return hit;
			}
		}
	}
	return null;
}

function judgeFind(args, ctx, planAt, refuse) {
	const roots = [];
	for (const a of args) {
		if (a.startsWith("-") || a === "(" || a === "!") break;
		roots.push(a);
	}
	if (roots.length === 0) roots.push(".");
	const destroys =
		args.includes("-delete") ||
		args.some((a, k) => {
			if (!["-exec", "-execdir", "-ok", "-okdir"].includes(a)) return false;
			const cmd = basename(args[k + 1] ?? "");
			if (REMOVERS.has(cmd) || cmd === "mv" || COPIERS.has(cmd)) return true;
			if (cmd === "sed" || cmd === "perl") {
				const rest = args.slice(k + 2);
				const end = rest.findIndex((x) => x === ";" || x === "+");
				return (end === -1 ? rest : rest.slice(0, end)).some((x) => /^-[a-zA-Z]*i/.test(x));
			}
			return false;
		});
	if (!destroys) {
		for (const r of roots) planAt(r);
		return {};
	}
	for (const r of roots) {
		const hit = planAt(r);
		if (hit) return refuse(hit);
		const p = abs(r, ctx.cwd);
		if (holdsPlans(p) || planPathOf(p)) return { refusal: documentRefusal(p, ctx) };
	}
	return {};
}

function judgeGit(args, ctx, planAt, refuse) {
	let at = ctx.cwd;
	let k = 0;
	while (k < args.length && args[k].startsWith("-")) {
		if (args[k] === "-C") {
			at = abs(args[k + 1] ?? ".", at);
			k += 2;
		} else if (args[k] === "-c") k += 2;
		else k++;
	}
	const sub = args[k];
	const rest = args.slice(k + 1);
	const firstPlanArg = (list) => {
		for (const a of list) {
			const hit = planAt(flagValue(a) ?? a, at);
			if (hit && (!a.startsWith("-") || a.includes("="))) return hit;
		}
		return null;
	};
	if (sub === "mv") {
		const hit = firstPlanArg(nonFlags(rest));
		return hit ? refuse(hit) : {};
	}
	if (sub === "rm") {
		if (rest.includes("--cached")) return {};
		const hit = firstPlanArg(nonFlags(rest));
		return hit ? refuse(hit) : {};
	}
	if (sub === "restore") {
		const staged = rest.some((a) => a === "--staged" || a === "-S");
		const worktree = rest.some((a) => a === "--worktree" || a === "-W");
		if (staged && !worktree) return {};
		const hit = firstPlanArg(nonFlags(rest));
		return hit ? refuse(hit) : {};
	}
	if (sub === "checkout") {
		const dd = rest.indexOf("--");
		const candidates =
			dd !== -1
				? rest.slice(dd + 1)
				: nonFlags(rest).filter((a) => a.includes("/") || existsSync(abs(a, at)));
		const hit = firstPlanArg(candidates);
		return hit ? refuse(hit) : {};
	}
	if (sub === "clean" && rest.some((a) => a === "--dry-run" || /^-[a-zA-Z]*n/.test(a))) {
		// A dry run lists what it would remove and removes nothing (A98).
		for (const a of nonFlags(rest)) planAt(a, at);
		return {};
	}
	if (sub === "apply" || sub === "clean") {
		const hit = firstPlanArg(rest);
		if (hit) return refuse(hit);
		if (sub === "apply") {
			const patched = patchedPlanPath(nonFlags(rest), at, planAt);
			if (patched) return refuse(patched);
		}
		if (sub === "clean" && nonFlags(rest).length === 0 && planPathOf(at)) {
			return { refusal: documentRefusal(at, ctx) };
		}
		return {};
	}
	// Everything else (add, commit, diff, log, show, status, merge, pull,
	// switch, reset, stash, rebase …) reads, or moves between committed states.
	for (const a of nonFlags(rest)) planAt(a, at);
	return {};
}

/**
 * An interpreter's inline text (`-e`, `-c`, `--eval`), and, when it names no script file (none,
 * or `-`), the here-document or here-string it reads as its script. Text with a write call that
 * names a plan path, is given one as an argument, or runs in a plan folder, is refused (A97);
 * standard-stream writes are reads (A98). A script file is not read (U1).
 */
function judgeInline(verb, args, ctx, planAt, stdinText) {
	const texts = [];
	const positional = [];
	let stdinScript = false;
	for (let k = 0; k < args.length; k++) {
		const a = args[k];
		if (a === "-") {
			if (texts.length === 0) stdinScript = true;
			continue;
		}
		if (!a.startsWith("-")) {
			if (texts.length === 0 && !stdinScript) return {}; // a script file: not read (U1)
			positional.push(a);
			continue;
		}
		const inline =
			a === "--eval" ||
			a === "--print" ||
			(verb === "python" || verb === "python3" ? a === "-c" : /^-[a-zA-Z]*[ep]$/.test(a));
		if (inline && typeof args[k + 1] === "string") {
			texts.push(args[k + 1]);
			k++;
		}
	}
	if (texts.length === 0 && stdinText !== "") texts.push(stdinText);
	for (const text of texts) {
		if (!writesFile(text)) continue;
		const named = PLAN_IN_TEXT.exec(text);
		if (named) {
			const word = /^[^\s'"`,)]*/.exec(text.slice(named.index))[0];
			planAt(word);
			return { refusal: documentRefusal(abs(word, ctx.cwd), ctx) };
		}
		const given = positional.map((p) => planAt(p)).find(Boolean);
		if (given) return { refusal: documentRefusal(given.path, ctx) };
		if (planPathOf(ctx.cwd)) return { refusal: documentRefusal(ctx.cwd, ctx) };
	}
	return {};
}

/** `$NAME` or `${NAME}`, a shell variable read. */
const VARIABLE = /\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g;
/** Words that only assign: `F=x`, `export F=x`, `local F=x`. */
const ASSIGNING = new Set(["export", "local", "declare", "readonly", "typeset"]);

/**
 * The segment with each variable an earlier segment assigned put in its place, so
 * `F=<plan path>; echo x >> $F` is read as the write it is (A97). A segment that only assigns
 * records its values for the segments after it.
 */
function withVariables(seg, vars) {
	const put = (w) => w.replace(VARIABLE, (m, a, b) => vars.get(a ?? b) ?? m);
	const words = seg.words.map(put);
	const redirects = seg.redirects.map((r) => ({ ...r, target: put(r.target) }));
	const assigns = words.filter((w) => !ASSIGNING.has(w));
	if (assigns.length > 0 && assigns.every((w) => /^[A-Za-z_]\w*=/.test(w))) {
		for (const w of assigns) vars.set(w.slice(0, w.indexOf("=")), w.slice(w.indexOf("=") + 1));
	}
	return { ...seg, words, redirects };
}

/** Judge a piece of shell text (a whole command, a `bash -c` string) in context. */
function judgeText(text, ctx) {
	const { tokens, subs } = lex(text);
	ctx.vars ??= new Map();
	let pipeSource = null;
	for (const raw of segmentsOf(tokens)) {
		if (planPathOf(ctx.cwd)) ctx.inPlan = true;
		const seg = withVariables(raw, ctx.vars);
		if (seg.sep !== "|" && seg.sep !== "|&") pipeSource = null;
		ctx.pipeSource = pipeSource;
		const r = judgeSegment(seg, ctx);
		if (r.refusal) return r;
		if (r.cwd) ctx.cwd = r.cwd;
		if (r.names) pipeSource = r.names;
	}
	for (const inner of subs) {
		const saved = ctx.cwd;
		for (const seg of segmentsOf(inner)) {
			const r = judgeSegment(seg, ctx);
			if (r.refusal) return r;
			if (r.cwd) ctx.cwd = r.cwd;
		}
		ctx.cwd = saved;
	}
	return {};
}

function shown(path, ctx) {
	const rel = relative(ctx.origin, path);
	return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
}

function documentRefusal(path, ctx) {
	const what = holdsPlans(path) ? "holds plan documents" : "is a plan document";
	return `refused: ${shown(path, ctx)} ${what}; use the Edit tool (or the indusk command for it) so its checks run`;
}

function folderRefusal(path, hit, ctx) {
	return `refused: ${shown(path, ctx)} is a plan folder; archive a plan with \`indusk plans archive ${hit.plan}\`, which moves it through git, and edit its documents with the Edit tool`;
}

/**
 * The guard's reading of a command: the refusal (null to allow), the plan
 * paths it names, and whether any part of it runs inside a plan folder. A
 * command it cannot parse is allowed, naming nothing.
 *
 * @param {unknown} command
 * @param {string} cwd
 * @returns {{ refusal: string | null, files: string[], inPlan: boolean }}
 */
export function judgeCommand(command, cwd) {
	const origin = resolve(typeof cwd === "string" && cwd !== "" ? cwd : process.cwd());
	const ctx = { cwd: origin, origin, files: new Set(), inPlan: false };
	if (typeof command !== "string" || command.trim() === "") {
		return { refusal: null, files: [], inPlan: false };
	}
	try {
		const r = judgeText(command, ctx);
		return { refusal: r.refusal ?? null, files: [...ctx.files], inPlan: ctx.inPlan };
	} catch {
		return { refusal: null, files: [], inPlan: false };
	}
}

/** Why a shell command is refused, naming the file and the tool to use; null to let it run. */
export function refusalFor(command, cwd) {
	return judgeCommand(command, cwd).refusal;
}

const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Write the decision for the package to judge (Decision 8): a refused command,
 * or one that names a plan path or runs in a plan folder, is a line in the
 * decision file with the plan folders' state before it; every allowed command
 * also leaves that state for `plan-write-witness.js`, which adds the state
 * after and records an unnamed command only when a plan document changed (a
 * script the guard cannot read, U1). A verdict is never written here.
 */
function recordDecision(event, command, cwd, judged) {
	const root = planRootOf(cwd);
	if (!root) return;
	const home = projectHome(root);
	const archived = judged.files
		.map((f) => planPathOf(f))
		.filter((hit) => hit?.archived)
		.map((hit) => hit.plan);
	const line = {
		kind: "decision",
		toolUseId: toolUseKey(event),
		at: new Date().toISOString(),
		command,
		cwd,
		decision: judged.refusal ? "refused" : "allowed",
		files: judged.files.map((f) => relative(root, f)),
		before: planFolderSnapshot(root, archived),
	};
	const named =
		judged.refusal !== null ||
		judged.files.length > 0 ||
		judged.inPlan ||
		PLAN_IN_TEXT.test(command);
	if (named) appendDecision(home, line);
	if (judged.refusal) return; // a refused command never runs: no after
	const pending = join(home, PENDING_DIR);
	mkdirSync(pending, { recursive: true });
	writeFileSync(
		join(pending, `${line.toolUseId}.json`),
		JSON.stringify({ ...line, named, archived }),
	);
	sweepPending(pending);
}

/** A command that failed or was refused by another hook leaves its pending file: drop those over an hour old. */
function sweepPending(dir) {
	const cutoff = Date.now() - PENDING_MAX_AGE_MS;
	for (const name of readdirSync(dir)) {
		try {
			if (statSync(join(dir, name)).mtimeMs < cutoff) rmSync(join(dir, name), { force: true });
		} catch {
			// another hook got there first
		}
	}
}

async function main() {
	let input = "";
	for await (const chunk of process.stdin) input += chunk;
	let event;
	try {
		event = JSON.parse(input);
	} catch {
		process.exit(0); // never block on our own parse failure
	}
	if (event?.tool_name !== "Bash") process.exit(0);
	const command = event.tool_input?.command;
	if (typeof command !== "string") process.exit(0);
	const cwd = typeof event.cwd === "string" && event.cwd !== "" ? event.cwd : process.cwd();
	const judged = judgeCommand(command, cwd);
	try {
		recordDecision(event, command, cwd, judged);
	} catch {
		// The record is for the signals; failing to write it never blocks a command.
	}
	const { refusal } = judged;
	if (refusal) {
		process.stderr.write(
			[
				`plan-write-guard: ${refusal}.`,
				"promise: a-plan-document-is-written-through-its-checks",
				"",
				"A plan document changes through the Edit tool, where check-gates and the impl",
				"validator run, or through the indusk command that owns it (plans accept-brief,",
				"plans approve, plans archive, promises declare …). Reading it from the shell is fine.",
				"",
			].join("\n"),
		);
		process.exit(2);
	}
	process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(() => process.exit(0));
}
