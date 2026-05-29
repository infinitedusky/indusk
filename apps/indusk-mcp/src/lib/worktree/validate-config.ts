import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ErrorObject } from "ajv";

/**
 * Validator for `.indusk/worktree-configs/<repo>.json`. Schema lives at
 * `apps/indusk-mcp/extensions/worktree/config.schema.json`. The validator
 * loads the schema at module-init and re-uses a compiled validate function
 * across calls.
 *
 * Contract:
 *   validateWorktreeConfig(input) →
 *     { valid: true } | { valid: false, errors: WorktreeConfigValidationError[] }
 *
 * Errors NAME the offending field (per T12 — stack traces don't count;
 * the user needs to know which key is wrong). Never throws on garbage input.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// Schema lives next to the extension manifest, two `..`s up + extensions/worktree/
const SCHEMA_PATH = join(
	__dirname,
	"..",
	"..",
	"..",
	"extensions",
	"worktree",
	"config.schema.json",
);

export interface WorktreeConfigValidationError {
	field: string;
	message: string;
	expected?: unknown;
	got?: unknown;
}

export type WorktreeConfigValidationResult =
	| { valid: true }
	| { valid: false; errors: WorktreeConfigValidationError[] };

let cachedValidate: ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

function loadValidator(): typeof cachedValidate {
	if (cachedValidate) return cachedValidate;
	const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
	// allErrors=true so we surface every problem in one pass — better UX than
	// having the user fix one field at a time. AjvCtor needed because of the
	// CommonJS-to-ESM interop wart in ajv's d.ts; runtime call works either way.
	const AjvCtor = (Ajv as unknown as { default?: typeof Ajv }).default ?? Ajv;
	const ajv = new AjvCtor({ allErrors: true, strict: false });
	cachedValidate = ajv.compile(schema) as typeof cachedValidate;
	return cachedValidate;
}

/** Convert an Ajv error into the public error shape (field-named). */
function toFieldError(e: ErrorObject): WorktreeConfigValidationError {
	// instancePath is "/foo/bar"; turn into "foo.bar" for human display.
	const instancePathSegment = e.instancePath.replace(/^\//, "").replace(/\//g, ".");

	// Additional-property errors put the offending key in params.additionalProperty,
	// NOT instancePath — so the field name needs to come from there.
	if (e.keyword === "additionalProperties") {
		const additional = (e.params as { additionalProperty?: string }).additionalProperty;
		const field = additional ?? instancePathSegment;
		return {
			field,
			message: `unknown top-level key '${field}'`,
		};
	}

	// Required-property errors put the missing key in params.missingProperty,
	// NOT instancePath.
	if (e.keyword === "required") {
		const missing = (e.params as { missingProperty?: string }).missingProperty;
		const field = missing ?? instancePathSegment;
		return {
			field,
			message: `required field '${field}' is missing`,
		};
	}

	// Everything else (type mismatch, enum mismatch, minLength, etc.) has the
	// field path in instancePath.
	const field = instancePathSegment.length > 0 ? instancePathSegment : "(root)";
	return {
		field,
		message: `${field} ${e.message ?? "is invalid"}`,
		expected: e.schema as unknown,
	};
}

/**
 * Validate a parsed JSON object against the worktree config schema.
 * Never throws — garbage input returns `{ valid: false }`.
 */
export function validateWorktreeConfig(input: unknown): WorktreeConfigValidationResult {
	// AJV rejects non-objects (or accepts and reports them via schema).
	// Wrapping in try/catch makes the contract "never throws" robust against
	// schema-load failures or transient issues.
	try {
		const validate = loadValidator();
		const ok = validate(input);
		if (ok) return { valid: true };
		const errors = (validate.errors ?? []).map(toFieldError);
		return { valid: false, errors };
	} catch (err) {
		return {
			valid: false,
			errors: [
				{
					field: "(validator)",
					message: `validator threw: ${(err as Error).message}`,
				},
			],
		};
	}
}
