---
title: "Server provisioning — one command gives a project its server"
date: 2026-10-04
status: draft
workflow: feature
---

# Server provisioning — Brief

## Problem

Standing up the always-on server took eight Fly commands, a dedicated IPv4 and
three secrets on 2026-10-04. A new project in the demo needs its server in one
step.

## Direction

- `indusk server deploy` (name to settle): creates the Fly app and volume,
  generates and stores the password, takes the Slack webhook, sets the public
  query URL, deploys the published version, allocates addresses, and writes
  the project's production source into `.indusk/config.json`.
- Idempotent: running it again on an existing app updates it.
- Fly only for now; the minimal slice of
  [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).

## Part of

[indusk-demo](../indusk-demo/master.md), step 5.
