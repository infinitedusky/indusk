---
title: "Day step 4b′ — Always-on — Test Plan"
date: 2026-09-19
status: draft
---

# Day step 4b′ — Always-on — Test Plan

## Purpose

What must be true for a promise broken in a deployed run to be kept, noticed,
announced, recorded and raised — with the developer's machine off at the
moment it breaks. Each assertion names the mechanism that will test it; they
become the impl's Test Trajectory rows.

Two mechanisms carry most of this. The **server** rows run the real shipped
Jaeger in its server configuration, started by the test on free ports with a
temporary volume — the same choice day-monitor made, for the same reason: a
stub would test our reading of our own guess. The **Slack** rows point the
webhook at a local capture server and read what was posted. Rows about what a
person sees go through the CLI, the admin over HTTP, or an MCP tool call.

## Behavioral Assertions

### The server keeps what it is sent

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A1 | A marked span sent to the server over OTLP with valid credentials is queryable afterwards | vitest integration, real Jaeger in server config |
| A2 | The same span is still there after the server restarts | vitest integration, restart between load and query |
| A3 | OTLP sent without credentials is refused, and nothing is stored | vitest integration |
| A4 | A query made without credentials is refused | vitest integration |

### The server announces a violation

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A5 | A violation in a deployed run produces one Slack message naming the promise, the symptom, the environment and a link to its trace | vitest integration, webhook capture server |
| A6 | The same violation seen by a later pass produces no second message | vitest integration, two passes over one violation |
| A7 | A promise seen upheld produces no message | vitest integration |
| A8 | A violation whose span carries no environment reads "environment unknown" rather than a guess | vitest integration |
| A9 | With Slack unreachable, the pass records the violation as unannounced and says so in the server's log; the next pass announces it | vitest integration, webhook server refusing connections |

### A developer machine reads the deployed system

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A10 | In a project configured to read the server, `indusk promises status` reports the deployed run's violations, not the local daemon's | vitest CLI against the server |
| A11 | With the server unreachable or the credential wrong, `status` names where it looked and exits non-zero; it never reports zero violations | vitest CLI |
| A12 | `indusk promises watch --source deployed` records an incident with source `deployed` and the environment, and reopens the owning plan | vitest CLI against the server |
| A13 | A violation already recorded is not recorded a second time by a later `watch` | vitest CLI, two passes |
| A14 | A project with no remote configured still reads its local daemon, exactly as before | vitest CLI (regression guard) |

### The admin shows it

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A15 | The Promises page of a project configured to read the server shows a violated promise red, naming its environment | vitest HTTP against `next dev` |
| A16 | A violation arriving while the page is open turns the promise red without a reload | vitest HTTP + Playwright, as the plan page's live rows are driven |
| A17 | With the server unreachable, every behaviour chip is hollow with "health unknown since …", and none is green | vitest HTTP |

### A session raises it

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A18 | Asked for promise health, an agent gets each behaviour promise's violations in the window, its open incidents, and violations not yet recorded as incidents | vitest integration (MCP tool call) |
| A19 | The health tool reports the same counts the CLI prints for the same project and window | vitest integration + CLI, one fixture |
| A20 | `/catchup`'s documented steps name promise health, and "what's next" reports open violations before the roadmap | vitest reading the skill text (the routing check a hook cannot make) |

### The loop closes, deployed

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A21 | End to end with the developer's machine idle: an app marks a promise violated, the server announces it to Slack, a later `watch --source deployed` records the incident with its environment and reopens the owner, and a session names it first | end-to-end test (`pnpm e2e`), server + capture webhook, run and recorded in the retrospective |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The Fly.io reference deployment accepts OTLP over TLS from an application, keeps traces across a machine restart, and posts to a real Slack channel | Needs a real Fly account, a real domain and a real Slack workspace; nothing in CI can stand in for the provider | A documented deploy-and-break procedure run once by hand, its output recorded in the retrospective; the same behaviours are tested against the local server by A1–A9 |
| U2 | Spans are not lost when the machine is asked to sleep (Fly auto-stop off) | A provider's scheduling behaviour, not ours | The deployment sets an always-on machine explicitly; the procedure in U1 checks a trace sent after an idle period arrives |

## Notes

- A9's "records the violation as unannounced" is the failure-safety rule
  day-monitor learned twice: a pass that cannot notify must not mark the
  violation announced, or it is lost. The inverse of the eval queue's
  ledger-before-spawn, and the same shape as the pending-eval un-drain.
- A14 guards the split-source change: naming a remote must not alter a
  project that names none.
- A20 tests skill text, not behaviour; it is the weakest row here. Its point
  is that "what's next" reporting promises is a documented instruction rather
  than a habit of one session.
- The environment comes from the span's resource attribute
  (`deployment.environment`); A8 fixes what happens when an application does
  not set it.
