# Every rule needs a test that asserts a refusal — acceptances cannot detect a dead rule

A test suite made only of acceptances measures nothing about whether your enforcement still runs.

**What happened.** Mid-plan, a reordering moved a validator's gate-completeness loop *after* the hook's terminal `process.exit(0)`. The loop became unreachable — gate completeness stopped running entirely. The observable result was **exit 0 with no message**, which is byte-for-byte indistinguishable from "everything passed". It surfaced only because one test case demanded a *no*: an impl with an open gate must be refused. That case went red. Every acceptance case stayed green, and would have stayed green forever.

**The rule.** For every rule you add, write at least one test that **fails when the rule stops running**. Concretely: feed it the input the rule must reject, and assert the rejection — the non-zero exit, the thrown error, the specific message.

**Two corollaries.**

1. **Pin the assertion to the rule's own signature, not to an incidental string.** A test that looked for a row ID in a refusal message passed while the rule under test never fired — a *different* rule's message happened to quote a checklist item containing that ID. Assert on a distinctive phrase from that rule's own output. A false green is silent and closes the file; a red is loud and gets investigated.

2. **Parity/differential suites need paired fixtures.** A suite comparing two implementations, fed only refusal cases, passes just as happily against two implementations that refuse *everything*. Every rule gets both an accept fixture and a refuse fixture.

**Smell test:** if someone deleted the body of your rule and replaced it with `return []`, which test goes red? If the answer is "none", the rule is unverified no matter how many tests reference it.
