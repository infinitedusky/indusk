# Write a promise's sentence from what its test rows can prove — or add a row for the widest case before accepting the brief; "every request" with rows that fetch synchronously is a promise the audit will find false

The browser-telemetry-leftovers brief promised that "every request the browser makes" carries the click's trace. Its rows (A1–A3, plus the live check) proved only a `fetch()` issued synchronously inside the click handler. Falsification then found the native-`await` gap (zone.js cannot follow it) and XHR/sendBeacon/EventSource were never instrumented; the cold audit found the sentence wider than its rows. The plan closed with the promise confirmed on A1–A3 while a documented limit contradicted its text.

**Why:** a confirmed promise is read later as a guarantee. Quantifiers ("every", "any", "nothing") are the widest claim a row can be asked to prove; a row set that covers the common case silently narrows the promise while the sentence keeps the wide wording.

**How to apply:** when drafting or accepting a brief, read each promise sentence's quantifiers and ask which row proves the widest case. Either narrow the sentence to what the rows prove (an explicit "synchronously in the handler", "fetch requests") or add a row for the widest case first. If a later deferral or skip narrows what holds, change the promise with `indusk promises change` before confirming, not after.

See `.indusk/planning/archive/browser-telemetry-leftovers/retrospective.md` and `audit.md`. Related: [[an-adr-rule-added-under-risks-can-falsify-an-accepted-brief-promise-reread-the-promise-sentences-in-the-same-sitting]].
