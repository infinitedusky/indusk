# A promise worded "is refused" must be enforced at the place a person acts (the approve route), in the same plan — a lint that reports the violation is not the refusal

component-content wrote the promise `placed-content-is-only-words-and-components` saying anything else "is refused". Only the lint refused it. The approve route, where a person's approval actually happens, checks hashes only, so a mockup with a drawing inside a component could still be approved. The audit found it at close and it was carried as a follow-on, which means the promise was confirmed while its refusal was not wired.

Why: a check that reports at the command (lint, status, audit) and a guard that stops the act at the place the person presses Approve are different things. A promise whose sentence is a refusal is only held when the act itself is refused; the report is evidence, not enforcement.

What to do: when a promise (or brief sentence) says "is refused", "cannot", or "never", name the place where the act happens (route, hook, command) in the plan, give that place a row that tries the forbidden act and asserts it is refused, and write the refusal in the same plan. If the lint is the only enforcer, word the promise as "is reported", not "is refused". Related lessons: a refusal that holds by accident is not a guarantee; assert a refusal, not just an acceptance.

See component-content's retrospective (highlights retro-audit and retro-hindsight, 2026-10-14).
