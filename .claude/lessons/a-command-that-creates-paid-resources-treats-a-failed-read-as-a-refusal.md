# A command that creates paid resources treats a failed read as a refusal, never as "nothing there"

A command that reads a provider's state and then creates what is missing must refuse when a read fails, naming the call. Parsing a failed read as an empty list makes "missing" true, and the command creates a duplicate the person pays for.

server-provisioning (2026-10-08): `readFlyState` parsed `fly volumes list` and `fly ips list` output with a fallback of `[]`, so a transient Fly error on a second run read as "no volume, no addresses", and `planDeploy` would have created a second volume and bought a second $2 dedicated IPv4 — breaking the promise that a second run never duplicates. Found by falsification (A22); the fix is a `FlyReadFailed` error for any non-zero exit or non-JSON answer.

How to apply: read everything first, plan purely over what was read, refuse before writing. A JSON parse helper with a default value is a smell in any reader that decides what to create.
