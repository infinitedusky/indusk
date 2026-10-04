---
title: "Always-on deploy — Test Plan"
date: 2026-10-04
status: draft
---

# Always-on deploy — Test Plan

## Purpose

What must be true for the always-on server to be something a person can deploy
and trust. Each assertion
names how it is tested. Rows marked **smoke** run against the real deployment
on Fly (personal org): no test in this repository can stand in for a provider.
They are scripted where possible, so they can be run again against any later
deployment, and are skipped when no deployment is named. The rest run in the
repository against a real local Jaeger or server, as every promise test does.

## Behavioral Assertions

| ID | Assertion (what a person deploying or reading sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | The image builds from the published package, and a container started without one of its settings exits naming the missing variable | vitest system tier: `docker build` + `docker run` against the local daemon, one run per required setting |
| A2 | On the deployed server, both doors refuse a request without credentials (401) and accept one with them | smoke, scripted: `pnpm smoke:deployed` — curl both public ports; skipped without `INDUSK_DEPLOYED_QUERY_URL` |
| A3 | A promise broken from a machine that is not the server reaches Slack within one pass interval, naming the promise, the symptom, the environment, the service and a trace link | smoke, scripted send + a person reading the channel |
| A4 | A trace sent before a machine restart is still there after it | smoke, scripted: send, `fly machine restart`, query |
| A5 | A violation sent after the server has sat idle for an hour is announced — the machine never went to sleep | smoke, timed: an hour of nothing, then send; a person reads the channel |
| A6 | A developer machine whose project names the deployed server reads it: `promises status` reports the smoke's violations and names the server, and the read is not *watcher blind* | smoke, scripted: a throwaway project naming `url`, `otlp_url`, `credential_env` |
| A7 | The deployed server is listening by its own account: its Jaeger holds a heartbeat less than two pass intervals old, and Slack has had no "watcher blind" message since the deploy | smoke, scripted query + a person reading the channel |
| A8 | Two always-on servers can run on one host at once | vitest system tier: start two real servers concurrently; both answer |
| A9 | The guide and reference no longer call the image or the Fly configuration unrun, and say what was observed | vitest unit over the docs pages |

## Notes

- **A1 needs no Fly.** A local docker daemon exists, so the image's refusals are
  a repository test. They are what `day-always-on`'s A1–A4 asserted through the
  CLI, now through the container.
- **A5 is the step people skip.** Its row cannot pass in under an hour. That is
  the point: a provider quietly stopping an idle machine is the failure it
  exists to catch.
- **A8 is the gRPC port** carried in from watcher-heartbeat. Today the second
  server fails to bind 16685, which is why every always-on test file runs
  alone.
- **The timeline moved out on 2026-10-04** to
  [promise-timeline](../promise-timeline/brief.md), with the five assertions
  drafted for it here; this plan keeps the server, the image and the smoke.
- **Secrets never enter the repository or the chat.** The server password is
  generated and set as a Fly secret, with a copy in `~/.indusk/config.env`. The
  Slack webhook is set by the person. The project names only the variable.
