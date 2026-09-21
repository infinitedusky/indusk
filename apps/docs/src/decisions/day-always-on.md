# Always on (Day 4b′)

The [promise loop](/guide/promises) worked on a laptop. Your laptop is not on
at three in the morning, and a promise broken then is broken whether or not
anyone is watching. This moved the watching half somewhere that stays on.

Full ADR: `.indusk/planning/archive/day-always-on/adr.md`.

## What was decided

**The server is the Jaeger InDusk already ships**, run as a long-lived process
instead of a developer-machine daemon. Two differences and only two: badger on
a volume instead of memory, and basic auth on both doors — the OTLP receiver
and the query API. Verified against the real binary, including that an
unauthenticated POST is refused *and stores nothing*, and that a trace
survives a restart.

*Against:* a hosted tracing product, or a second telemetry stack. A second
stack is a second thing to keep true, and the loop's one backend should be the
one already tested.

**The detection pass runs inside the server, on its own interval.** No
scheduler, no second container, no cron entry to get wrong — the thing that is
always on is already always on. It knows no promises: the registry lives in a
plan repository, so a span marked violated *is* a violation and that is the
whole of the server's knowledge.

**Detect and notify only.** The server never writes back. Recording an incident
and reopening a plan are writes to a git repository, and a server that edits
your planning documents unattended is a server you cannot trust. Those happen
on a developer machine, deliberately, via `promises watch --source deployed`.

**A project names the Jaeger it reads** — `promises.jaeger` with a `url` and a
`credential_env` naming the *variable* that holds the credential, never the
credential (the config is committed). **Absence means the local daemon**, so
nothing changes for a project that names nothing. A named server that cannot
be reached refuses against its URL rather than falling back: answering a
question about production with a laptop's traces is the worst outcome
available.

**The environment comes from the span** — OpenTelemetry's own
`deployment.environment` resource attribute, not an InDusk-specific one. A
system that is already instrumented has set it; asking for a second attribute
is asking it to carry InDusk in its code. A span that carried none reads
*environment unknown* rather than a guess, because one server holds staging
and production.

**Fly.io is the reference deployment, not a requirement.** The server needs a
container, a persistent disk and TLS; several things provide those.

## Tradeoffs accepted

- **Basic auth, not tokens.** The shipped Jaeger build has `basicauth` and not
  `bearertokenauth`. Credentials travel on every request, so anything off
  localhost needs TLS in front of it.
- **One machine, deliberately.** Badger is a single-writer embedded store. Two
  machines sharing a volume is unsupported; two with separate volumes would
  each hold half the violations and each announce what the other could not
  see.
- **The image installs the published package**, never the working tree — a
  server watching promises with code nobody else has is not a reference
  deployment. This makes the release a hard prerequisite for deploying.
- **The image and the Fly config shipped unrun**, and say so in the guide.
  Verifying them is `day-always-on-deploy`; until it closes, that section is a
  starting point rather than a recipe.
