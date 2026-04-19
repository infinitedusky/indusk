/**
 * Scorecard extractor — pulls the scorecard JSON object out of arbitrary
 * Claude-CLI output. Tolerates three output shapes the model produces in
 * practice:
 *
 *   1. Pure JSON: `{...}`
 *   2. Fenced JSON: ` ```json\n{...}\n``` ` or ` ```\n{...}\n``` `
 *   3. Prose-prefixed/wrapped JSON: `Sure, here's the result: {...}` or
 *      `Some intro\n```json\n{...}\n```\nDone.`
 *
 * The third case is what bit eval-agent-mcp-access smoke 4 — see
 * `.indusk/planning/eval-scorecard-format-fix/brief.md`.
 */

/**
 * Extract a balanced JSON object from arbitrary text. Returns the JSON
 * substring (just the `{...}` part) or null if no balanced object exists.
 *
 * Strategy order:
 *   1. If the text trims to a string starting with `{`, try parsing as-is.
 *   2. If a markdown code fence wraps the JSON, extract from inside the fence.
 *   3. Otherwise scan for the first `{` and find its matching `}` by
 *      tracking nesting depth and string-literal state (so braces inside
 *      string values don't fool the depth counter).
 *
 * The caller is responsible for `JSON.parse`-ing the returned substring.
 * This function only locates the JSON; it doesn't validate it.
 */
export function extractScorecardJson(text: string): string | null {
	if (!text) return null;

	// Strategy 1: pure JSON (cleanest case)
	const trimmed = text.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		try {
			JSON.parse(trimmed);
			return trimmed;
		} catch {
			// Fall through to other strategies — the trim-and-test was a quick check
		}
	}

	// Strategy 2: fenced code block — ```json ... ``` or ``` ... ```
	const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (fenceMatch?.[1]) {
		const inside = fenceMatch[1].trim();
		try {
			JSON.parse(inside);
			return inside;
		} catch {
			// Fall through — fence content wasn't valid JSON, try balanced-brace scan
		}
	}

	// Strategy 3: balanced-brace scan
	const balanced = findFirstBalancedJsonObject(text);
	if (balanced) {
		try {
			JSON.parse(balanced);
			return balanced;
		} catch {
			return null;
		}
	}

	return null;
}

/**
 * Walk the text looking for the first `{` and find its matching `}`,
 * tracking string-literal state and escape characters so braces inside
 * string values don't confuse the depth counter.
 *
 * Returns the substring including both braces, or null if no balanced
 * object exists in the text.
 */
function findFirstBalancedJsonObject(text: string): string | null {
	const start = text.indexOf("{");
	if (start === -1) return null;

	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = start; i < text.length; i++) {
		const ch = text[i];

		if (escaped) {
			// Previous character was a backslash — consume this character without
			// interpreting it. Reset the escape flag.
			escaped = false;
			continue;
		}

		if (ch === "\\") {
			// Inside a string, a backslash escapes the next character. Outside a
			// string, this shouldn't occur in valid JSON but we handle it
			// defensively.
			escaped = true;
			continue;
		}

		if (ch === '"') {
			// Toggle string-literal state.
			inString = !inString;
			continue;
		}

		if (inString) continue;

		if (ch === "{") {
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) {
				return text.slice(start, i + 1);
			}
			if (depth < 0) {
				// Unmatched closing brace — give up.
				return null;
			}
		}
	}

	// Walked to end of string without closing the outermost brace.
	return null;
}

/**
 * Defensive accessor for `scorecard.questions`. Returns the array if the
 * field is array-shaped; returns `[]` for any other shape (missing, null,
 * boolean, number, object-keyed-by-id, etc.). The model occasionally invents
 * its own scorecard schema and puts non-arrays here — the wrapper must not
 * crash when that happens.
 *
 * Use this everywhere the wrapper iterates `scorecard.questions`. Never
 * iterate the field directly (with `?? []` or otherwise) — `?? []` only
 * catches null/undefined, not falsy-but-not-nullish values like `false`,
 * `0`, `""`, or non-array objects.
 *
 * Surfaced bugs this prevents:
 *   - `for (const q of scorecard.questions)` when `questions` is missing
 *   - `for (const q of scorecard.questions ?? [])` when `questions` is `{}`
 *     (e.g., model returned `questions: { conventions: {...} }` keyed by id)
 */
export function getScorecardQuestions<T>(scorecard: { questions?: unknown }): T[] {
	return Array.isArray(scorecard.questions) ? (scorecard.questions as T[]) : [];
}

/**
 * Build an error message for the case where scorecard parsing failed.
 * Includes the underlying error and a snippet of the raw stdout so post-
 * mortem debugging is possible from `results.log` alone, without re-running.
 */
export function formatParseError(err: unknown, rawStdout: string): string {
	const errMsg = err instanceof Error ? err.message : String(err);
	const snippet = rawStdout.slice(0, 500);
	return `${errMsg}\n\nstdout snippet (first 500 chars):\n${snippet}`;
}
