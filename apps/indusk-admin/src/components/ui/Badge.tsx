import type { HTMLAttributes } from "react";

/**
 * Trajectory states from `apps/indusk-mcp/src/lib/trajectory/parser.ts`.
 * The Badge variant set mirrors them so trajectory rows map 1:1.
 */
export type BadgeVariant =
	| "passing"
	| "blocked"
	| "skipped"
	| "planned"
	| "writable"
	| "written"
	| "unknown"
	| "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
}

/**
 * Color palette per A9 visibility requirement: pass/fail status
 * legible at a glance without reading the State text.
 *
 * - passing: green (success)
 * - blocked: red (attention required)
 * - skipped: muted/yellow (intentional non-test)
 * - planned/writable/written: gray-toned (in flight)
 * - unknown: gray (parser fallback)
 * - neutral: utility variant for non-trajectory uses (status labels, etc.)
 */
const variantClasses: Record<BadgeVariant, string> = {
	passing: "bg-green-100 text-green-800 ring-green-600/20",
	blocked: "bg-red-100 text-red-800 ring-red-600/20",
	skipped: "bg-yellow-100 text-yellow-800 ring-yellow-600/20",
	planned: "bg-gray-100 text-gray-700 ring-gray-500/20",
	writable: "bg-gray-200 text-gray-800 ring-gray-500/20",
	written: "bg-blue-50 text-blue-700 ring-blue-600/20",
	unknown: "bg-gray-50 text-gray-500 ring-gray-400/20",
	neutral: "bg-gray-100 text-gray-700 ring-gray-500/20",
};

export function Badge({ variant = "neutral", className = "", children, ...rest }: BadgeProps) {
	const classes = [
		"inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
		variantClasses[variant],
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<span className={classes} {...rest}>
			{children}
		</span>
	);
}
