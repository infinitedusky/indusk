# A rate-limited start is retried, not marked violated — the API's refusal is not the evaluator's failure

Between 2026-10-03 and 2026-10-05 nine commits were never graded. Each one's evaluator was refused by the API before its first turn ("Server is temporarily limiting requests (not your usage limit)", `api_error_status: 429`), and each refusal was recorded as a violation of `every-commit-evaluated`. They came in bursts: a landing makes four commits in seconds, each commit starts an evaluator, and some of them — duplicates, until A32 — were turned away. The evaluator retried only a *resumed* session that failed; a fresh start that failed was final.

Why it matters: a rate limit says "not now", not "this cannot be done". Treating it as a failure turns a busy minute into ungraded commits and a red promise, and the incident that follows is about the API's load, not about anything the code did.

What to do: when a run's JSON says `api_error_status: 429`, wait and start it again — a bounded number of times, with a backoff long enough for a burst to pass (15 s, 45 s, 90 s in `lib/eval/persistent-evaluator.ts`) — and mark the run violated only when every try was refused. Guarded by `monitor-mark.test.ts` (A33).
