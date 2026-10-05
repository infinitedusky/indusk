---
title: "Demo app template — an app with promises to deploy and break"
date: 2026-10-04
status: draft
workflow: feature
---

# Demo app template — Brief

## Problem

The only things that mark promises today are the evaluator and the smoke
script. The demo needs a real, small application: deployed, marking its
promises through plain OpenTelemetry, with a way to break one on cue.

## Direction

- A minimal service (Node) with two promises, marked at their sites with the
  standard span attributes, exporting OTLP to the project's server.
- A Fly config for it beside the always-on server's.
- A switch (an env var or an endpoint) that makes one promise fail, so the
  demo's production break is reproducible.
- Shipped as a template a new project starts from.

## Part of

[indusk-demo](../indusk-demo/master.md), step 4.
