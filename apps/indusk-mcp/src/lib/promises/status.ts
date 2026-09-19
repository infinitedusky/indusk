import type { PromiseEntry } from "./registry.js";
import type { MarkedSpansResult } from "./telemetry.js";

/**
 * `indusk promises status`'s text (day-monitor, ADR D5).
 *
 * One block per promise, opening on a line that starts with its name, blocks
 * separated by a blank line. A behaviour promise gets what telemetry saw in
 * the window: its violations with their traces, and when it was last seen
 * upheld — or "not seen", which is never the same as upheld or as zero
 * violations. State and structure promises are listed as watched by the
 * suite and given no count: telemetry has nothing to say about them.
 */

function iso(d: Date): string {
	return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** "the last 7 days", "the last 1 day", or a `--since` value as given ("the last 24h"). */
export function windowPhrase(window: number | string): string {
	if (typeof window === "string") return `the last ${window}`;
	return `the last ${window} day${window === 1 ? "" : "s"}`;
}

export function formatStatus(
	promises: PromiseEntry[],
	marks: MarkedSpansResult,
	window: number | string,
): string {
	const phrase = windowPhrase(window);
	const blocks: string[] = [`Promises observed in ${phrase}, from Jaeger at ${marks.queryUrl}`];
	const sorted = [...promises].sort((a, b) => a.name.localeCompare(b.name));
	for (const p of sorted) {
		const head = `${p.name} (${p.kind}, ${p.domain}, ${p.state})`;
		if (p.state === "retired") {
			blocks.push(`${head}\n  retired — not watched`);
			continue;
		}
		if (p.kind !== "behaviour") {
			blocks.push(`${head}\n  watched by the suite at head, not by telemetry`);
			continue;
		}
		const m = marks.byPromise.get(p.name);
		if (!m || (m.violations.length === 0 && m.lastUpheld === null)) {
			blocks.push(`${head}\n  not seen in ${phrase} — no run exercised it`);
			continue;
		}
		const lines = [head];
		const n = m.violations.length;
		lines.push(
			n === 0
				? `  no violations in ${phrase}`
				: `  ${m.truncated ? "at least " : ""}${n} violation${n === 1 ? "" : "s"} in ${phrase}`,
		);
		for (const v of m.violations) {
			lines.push(
				`    ${v.traceId}  ${iso(v.at)}  ${v.service}${v.symptom ? `  ${v.symptom}` : ""}`,
			);
		}
		lines.push(
			m.lastUpheld
				? `  last seen upheld ${iso(m.lastUpheld.at)} (${m.lastUpheld.traceId})`
				: `  not seen upheld in ${phrase}`,
		);
		blocks.push(lines.join("\n"));
	}
	return blocks.join("\n\n");
}

/** `24h`, `7d`, `90m` → milliseconds; null when unreadable. */
export function parseDuration(text: string): number | null {
	const m = /^(\d+)\s*([mhd])$/.exec(text.trim());
	if (!m) return null;
	const n = Number(m[1]);
	if (n <= 0) return null;
	const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "m" | "h" | "d"];
	return n * unit;
}
