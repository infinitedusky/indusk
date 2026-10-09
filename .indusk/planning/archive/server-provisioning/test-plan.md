---
title: "Server provisioning — Test Plan"
date: 2026-10-08
status: accepted
---

# Server provisioning — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows this document is constrained by "what makes all these assertions true?" rather than invented from intuition.

Two commands are under test: **connect**, which points a project at a server the person runs, and **deploy**, which creates one on Fly and then connects. A `unit` row feeds the command a fake Fly, a fake probe and a temporary home, and reads what it did; a `live check` row runs the real thing once against Fly and is recorded in the plan with its result and its cost.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** Describe what the user sees, what the API returns to a caller, what an external observer measures — never internal function calls, return types, or method signatures. If a non-engineer stakeholder couldn't read an assertion and understand it, rewrite it.

### `a-project-connects-to-its-server-in-one-command` — one command points a project at a recording server the person runs

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | After connect is given a server's query address, its intake address and a credential, the project's config names that server as its production source — the two addresses and the *name* of the credential variable, never the credential. | unit |
| A2 | After connect, the credential's value is in the machine's secrets file under the variable the config names, readable by the owner only. | unit |
| A3 | After connect, a promise read on the project shows two sources, local and production, and production is the server just named. | unit |
| A4 | Connecting a project to the deployed server and opening the admin shows that server's promises on the Promises page. | live check |

### `a-fly-deploy-is-one-command` — one command creates the server on Fly and connects the project

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | Deploy on a project with no server creates the app, the volume, the secrets, the deployment and the addresses, then connects the project, in that order, asking nothing it did not say up front. | unit |
| A6 | The server deploy creates runs the same version as the person's `indusk`, as one machine, with its public query address naming the app, and a Slack webhook when one was given. | unit |
| A7 | Deploy without a Slack webhook finishes and says announcements are off. | unit |
| A8 | A real deploy to Fly ends with the project connected and its first production read alive, within ten minutes, for a cost the plan records. | live check |

### `provisioning-never-prints-a-secret` — the password and the webhook never appear anywhere but the machine's secrets

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | Nothing either command prints, on success or on any failure, contains the password or the webhook. | unit |
| A10 | After either command, the only change under the project is its config, and nothing in it contains the password or the webhook. | unit |

### `a-second-run-updates-not-duplicates` — a second run updates what exists

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | Deploy on a project whose server exists creates no app, volume or address, redeploys the current version, keeps the secrets, and connects again. | unit |
| A12 | Connect on a project that already names a server replaces the source and the stored credential; one of each remains. | unit |

### `provisioning-refuses-what-it-cannot-do` — the Fly command refuses by name before creating anything

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | With the Fly CLI missing or not signed in, deploy refuses, naming what is missing and the command that fixes it, and has run nothing that creates. | unit |
| A14 | When the app name is taken and is not recorded as this project's server, deploy refuses, naming the app and how to choose another name, and has created nothing. | unit |

### `a-server-is-read-back-before-the-command-ends` — either command ends only after the server is read back

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | Connect to a server whose mark does not come back ends non-zero, saying *watcher blind* with the intake and the reader it tried, and leaves the project's config unchanged. | unit |
| A16 | The read-back goes through the addresses the project will use, never an internal or loopback one. | unit |
| A17 | Deploy whose read-back fails ends non-zero naming what did not come back, and says the server exists so a second run can finish the job. | unit |

### `the-recording-server-runs-from-a-published-image` — every release publishes the image, and it runs anywhere

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | The release command publishes the image tagged with the version, and a release whose image push fails is not a release. | unit |
| A19 | The published image for the installed version starts with a volume, its two ports and its two secrets, and answers a mark sent through it, with no checkout on the host. | contract |
| A20 | Deploy pulls the published image for its version rather than building one. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A21 | The guide's "run your own server" page names every setting the server reads that has no default, the volume, the two ports, and the connect command, so a person on another host has everything in one place. | unit | a regression guard over the guide: a setting added to the server without a line in the guide is the 2026-10-04 deploy again |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Fly's CLI keeps the flags and defaults deploy relies on (`apps create`, `--ha=false`, address allocation, remote deploy). | A third party's tool; its changes arrive without notice, as `fly launch` rewriting the config did. | A8, the live check, is re-run at any release that touches deploy; a Fly command that fails is named in the refusal with its output, so the person sees which call changed. |

## Notes

- A8 and A4 cost money and minutes; they run once, by hand, and the plan records the result, the duration and the bill line. Everything else is fakes and a temporary home.
- A19 needs Docker and the registry; it belongs in the system tier, at landing and release, never the everyday suite.
- Whether connect should write the config when the read-back fails (A15 says no) is the ADR's to confirm.
