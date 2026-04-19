---
title: "Gamma Missing ADR"
status: draft
workflow: feature
---

# Gamma — Brief

## Problem

Sample plan deliberately missing its ADR file to exercise the optional-document handling (T14).

## Proposed Direction

The plan has a brief and an impl but no `adr.md`. Reader should return `Plan { adr: undefined }` without throwing.
