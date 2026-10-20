---
name: admin-pages-load-fast
kind: behaviour
lifetime: holds
state: declared
domain: admin
owner: admin-pages-load-fast
sites: []
tests: []
incidents: []
clauses:
  - name: one-read-per-page
    kind: split
    statement: "A page reads the machine's process list and the trunk's landing history at most once, for all the plans it shows, never once per plan or per run."
  - name: kept-briefly
    kind: split
    statement: "Those reads are kept for a few seconds, so the page's own live refresh and the other pages reuse them instead of reading again."
  - name: never-freezes
    kind: limit
    statement: "No page starts another program in a way that stops the server answering other requests while it waits."
---

Every admin page answers in under a second.

## History
- 2026-10-20 — declared (admin-pages-load-fast), from its planning conversation.
