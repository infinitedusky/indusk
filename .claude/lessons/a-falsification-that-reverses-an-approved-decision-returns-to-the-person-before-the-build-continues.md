# A falsification that reverses a decision the person approved returns to the person before the build continues

In the-admin-knows-the-package-root the falsification phase reversed an approved impl Note ("child inheritance is intended") and the build continued with no amendment shown to the person. The brief-as-the-contract rule says a change to what was approved waits for a person.

**How to apply:** when a falsification hypothesis shows an approved decision (in the impl, ADR or brief) is wrong, record it as an amendment, or stop and say so, before the fix is built. A fix that only repairs a defect inside the approved design needs no stop; one that overturns a recorded decision does. See /decisions/brief-as-the-contract.

Source: highlight h-20261019-009 (retro-hindsight), plan the-admin-knows-the-package-root.
