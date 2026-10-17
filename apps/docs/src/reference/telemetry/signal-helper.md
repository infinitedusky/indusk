---
title: The signal helper
---

# The signal helper

A scaffolded app carries a small file it owns, `signal.ts` (Node and the Next.js server) or `indusk_signal.py` (Python), that tells InDusk whether a promise held. One call per verdict, from the place the behaviour happens.

```ts
import { signal } from "./signal";

signal.upheld({ promise: "a-hold-is-released", clause: "on-time", value: 812, bound: 1000 });
signal.broken({ promise: "a-hold-is-released", clause: "on-time", symptom: "released 5.1 s late" });
```

```python
from indusk_signal import signal

signal.upheld("a-hold-is-released", clause="on-time", value=812, bound=1000)
signal.broken("a-hold-is-released", symptom="released 5.1 s late", clause="on-time")
```

Each call writes one short span through OpenTelemetry's API, a child of the active span when there is one. The file imports nothing from InDusk (only `@opentelemetry/api`, or `opentelemetry.trace`, and the app's own settings file), so the span is ordinary OpenTelemetry: it exports wherever the app's tracer exports, and anyone with the raw trace can read which promise held and which broke. The Python file is not called `signal.py` because a file of that name would hide Python's own `signal` module.

## What a call writes

| Key | Written when | Meaning |
|-----|--------------|---------|
| `indusk.promise` | always | the promise's registry name; also the span's name |
| `indusk.promise.outcome` | always | `upheld` or `broken` |
| `indusk.promise.violated` (event) | broken | carries the symptom |
| `indusk.promise.symptom` | broken | one line saying what was seen |
| `indusk.clause` | given | which part of the promise this concerns, when several hold it |
| `indusk.signal.value`, `indusk.signal.bound` | given | what was measured and the bound it is held to |
| `indusk.signal.plan`, `indusk.signal.phase` | given | the plan and phase that made the promise |
| `indusk.project` | the settings name one | the InDusk project id, copied onto the span because the readers compare it there |
| `indusk.run` | in a test run | `test`, so a test's signal is told from a user's |

The helper writes `broken`. InDusk's own writers keep the older word `violated` until Signal first; every reader takes both.

## The vocabulary

The keys are defined once, in InDusk's `lib/promises/vocabulary.ts` (`APP_SIGNAL_KEYS` and `APP_RESOURCE_KEYS`). The helpers and the settings file spell them as strings, because an app imports nothing from InDusk, and a test (`signal-vocabulary-pin.test.ts`) holds both equal in both directions: a key added or changed on one side only fails, naming it. To write the same signal from another language, set these attributes on one span and add the symptom event on a break.

## The test-run marker

The settings file marks every span of a run under a test runner (`VITEST`, `JEST_WORKER_ID`, a Vite test build with `MODE=test`, or `NODE_ENV=test`; pytest for Python) with `indusk.run=test` on the resource, and the helper copies it onto its own span. A marked run still exports; what reads it decides what to do with it.

## An app that sets up OpenTelemetry itself

When an app already depends on an OpenTelemetry SDK (`@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-web`, `@vercel/otel`, or `opentelemetry-sdk` in Python), `indusk init` and `indusk update` write only the helper and the settings it reads, and say so. The seat-holds example (`indusk demo`) is such an app: it keeps its own provider and writes its release signal through a copy of the helper.

A browser-only app has no server to write a signal from, so it gets no helper.

## Keeping it current

The helper is recorded like every scaffolded file: `indusk update` refreshes it while you leave it as it is, and once you change it writes the newer version beside it as `signal.ts.indusk-new`. See [what a project is handed](./overview#what-a-project-is-handed).
