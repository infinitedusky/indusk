# A durability promise must name what it survives — "crash-safe" says nothing about clean failure

A queue drain wrote its "done" ledger entry BEFORE spawning each evaluator, deliberately, so a drain that crashed mid-record would leave a logged gap rather than double-evaluating. That reasoning is correct — and it silently created the opposite disaster: an evaluator that *cleanly exits non-zero* (missing CLI, broken runner, bad config) also left the record marked done, so a machine that couldn't evaluate anything marked the entire backlog processed, wrote zero results, and emptied the queue the system existed to protect. Health went quiet because the queue was empty.

**The pattern:** durability designs are usually reasoned against ONE failure mode (crash, power loss, network partition) and the guard is then assumed to be general. It never is. "Crash-safe" and "failure-safe" are different properties, and the gap between them is where data dies quietly.

**What to do:**
1. Write durability claims as "durable against X" and then list the OTHER failure modes explicitly — clean non-zero exit, timeout, partial write, permission error. For each: what happens to the record?
2. Prefer a **provisional ledger**: write the done-marker before the risky operation (crash-safety), then RETRACT it on a clean failure (failure-safety). At-most-once under crash, at-least-once under retry.
3. Make the failure loud in the operator-facing output — a maintenance command that destroys a backlog silently is worse than one that refuses to run.

