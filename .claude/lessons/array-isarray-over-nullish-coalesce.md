# Use `Array.isArray` over `?? []` for array-shaped fields

`?? []` only catches `null` and `undefined`. It does NOT catch falsy-but-not-nullish values like `false`, `0`, `""`, or non-array objects.

```ts
// Brittle — throws on `data: false`:
for (const x of data.field ?? []) { ... }

// Robust — handles any non-array shape:
const items = Array.isArray(data.field) ? data.field : [];
for (const x of items) { ... }
```

When iterating a field that comes from external input (LLM output, API response, parsed JSON, user-supplied data), the field can be anything. `Array.isArray` is the strict check that handles every malformed-shape case, not just nullish.

Surfaced in eval-scorecard-format-fix (1.24.4): the eval agent's `ingestScorecard` had `for (const q of scorecard.questions)` — when the model returned a scorecard with no `questions` field, the iterate threw `TypeError: scorecard.questions is not iterable`, which was then caught by the outer try/catch and produced a misleading `error: true` entry RIGHT AFTER the (wrong-shape) scorecard had already been written to disk.

The fix: `const questions = Array.isArray(scorecard.questions) ? scorecard.questions : []; for (const q of questions) { ... }`. Now any malformed shape (missing field, null, false, object, etc.) is treated as "no questions to ingest" rather than crashing.
