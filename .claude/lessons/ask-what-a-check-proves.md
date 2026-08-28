# Ask what a check proves, not whether it passes

A well-built check can be permanently green while the thing it appears to guard is broken, because it is answering a question adjacent to the one that matters.

Three instances, same shape:

- **Parity ≠ correctness.** A test compared every packaged skill to its installed copy byte-for-byte and passed. Two of those skills had no YAML frontmatter at all and could never be registered by the host — two identical *unregistrable* files are perfectly in parity. The check answered "did this sync", never "can this be used".
- **Presence ≠ capability.** A health check tested for a service-token file. The normal auth path was an interactive `doppler login`, which needs no token file — so the check went red on setups that worked fine. It tested for an artifact instead of asking whether authentication succeeds.
- **A flag that overrides a check discards the correct answer.** An extension marked `required: true` bypassed its own `detect` rule, which already asked precisely the right question. It then enabled everywhere and hard-errored for a credential most projects had no use for.

**The rule:** for each check, name the failure it is supposed to catch, then ask whether a green result actually rules that failure out. Prefer probing the capability (`can I authenticate?`, `does this register?`) over probing a proxy for it (`does this file exist?`, `do these bytes match?`).

The cost of getting this wrong is worse than a missing check: a check that is permanently red on healthy systems trains people to ignore the whole report, and a check that is permanently green on broken ones is a false guarantee people rely on.
