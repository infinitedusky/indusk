# Let errors propagate visibly

Don't silently swallow errors with empty catch blocks or fallback returns. Every `catch {}` is a future mystery bug.

If you catch an error, either:
- Re-throw it with context: `throw new Error("Failed to parse config", { cause: err })`
- Log it meaningfully and return an explicit failure value
- Handle it completely (not just suppress it)

Silent failures compound. One swallowed error leads to wrong data, which leads to wrong behavior three layers up.
