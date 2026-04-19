# Wrapper overrides LLM-supplied fields when the wrapper has the truth

When parsing JSON output from an LLM and the schema includes fields the calling code knows authoritatively (timestamps, durations, costs, counts of side effects), OVERRIDE those fields after `JSON.parse` rather than trusting the model's value.

```ts
const scorecard = JSON.parse(stdout) as Scorecard;
// Don't trust the model's timestamp — Claude doesn't know real time
// and rounds to 5-minute marks like "2026-04-19T18:25:00Z".
scorecard.timestamp = new Date().toISOString();
// Don't trust the model's count — wrapper observed actual calls.
scorecard.actualToolCalls = wrapperObservedToolCalls;
```

LLMs make up values they don't know. The model thinks it's helping by populating the field with a plausible value, but the wrapper has the actual measurement. Always prefer the wrapper's truth.

Surfaced in eval-scorecard-format-fix (1.24.3): scorecard `timestamp` field was being filled by Claude per the prompt template `"timestamp": "{ISO 8601 now}"`, and Claude was rounding to 5-minute marks. Reading `results.log` showed timestamps clustered at suspiciously round times. Fix: override `scorecard.timestamp = new Date().toISOString()` in the wrapper after parse.

Generalize this beyond timestamps: audit every LLM-output field. If the wrapper can compute or measure it, the wrapper should set it.
