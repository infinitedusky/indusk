---
name: a-propagation-entry-covers-what-it-names
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: browser-template-claims
sites: []
tests: []
incidents: []
---

An entry in the browser template's propagation setting sends the click's trace to the requests it names and to no others: an entry with a path covers that path and what is under it, an entry with a default port matches a request whose URL leaves the port off, and an exact entry and a pattern entry treat both the same way.

## History
- 2026-10-11 — declared (browser-template-claims), from its planning conversation.
