# "Exactly once" is a durability claim, not a logic claim — audit the read, the write, the atomicity and the concurrency, never the branch

A loop that skips what a record says it already did is trivially correct, and that correctness is worth nothing. Every real failure lives in the four things around the branch.

Found by falsification against a notifier that announced each violation once:

1. **Concurrency.** `setInterval` starts the next tick whether or not the last finished. Two passes both read the record before either wrote it → 25 violations became 50 messages. Fix: one run at a time, and say when a run was skipped.
2. **Write atomicity.** `writeFileSync` to the live path leaves a truncated file if the process dies mid-write. Fix: write a temp file, rename.
3. **Read failure semantics.** A corrupt record read as "empty" re-announces the whole window — and keeps doing it every interval forever. **Missing and unreadable are different facts.** Fix: absent means nothing done; unreadable means stop and say why.
4. **Write failure ordering.** Announcing and *then* failing to record is the same announcement again next interval, forever. Fix: prove the record is writable *before* the first side effect.

Plus a fifth that is not durability but arrives with it: **unbounded fan-out**. Hundreds of violations became hundreds of API calls in a tight loop, the service rate-limited, all of them counted as un-done, and the next pass retried all of them — a storm that never converges. Cap the batch, hold the rest, and report the number held.

**The rule:** when you write "exactly once", list those five and answer each in code. The comment claiming the property is not the property; in this case the comment said an unreadable record "costs a repeated message" while the code cost one every interval indefinitely — written by the same person, in the same sitting, next to the code that disproved it.
