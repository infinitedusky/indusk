# A background writer committing on a timer will collide with a developer's own git commits — write the durable record before the commit, and make partial commits resumable

In the incident-recording plan, the admin daemon commits incidents every `admin.refresh_ms` (as low as 5s) in the same checkout a developer is working in — `index.lock` held by the developer's own `git commit` is an everyday failure, not a contrived edge case (A27, Build Phase 8).

Why: any background process that commits to a repo a human is actively using will eventually lose a race for `index.lock`. If the lock failure happens after the important side effect (writing an inbox entry so a person/agent is told) but is treated as atomic with the git commit, the side effect is lost along with the commit.

How to apply: order writes so the thing a person must be told about is durable before the commit is attempted (write inbox/heard records first, commit second). Track what wasn't committed in a pending-paths file so the next pass finishes the job rather than retrying everything. Mark the pass as broken (not silently retried) until the backlog clears. This generalizes to any daemon or background agent committing alongside interactive use — not specific to InDusk's recorder.
