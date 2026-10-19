---
title: "New components draw in their mockups — Test Plan"
date: 2026-10-17
status: draft
---

# New components draw in their mockups — Test Plan

## `mockups-render-in-the-cockpit`

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A component a mockup declares new and draws itself takes that mockup's own styles in the cockpit. | unit |
| A2 | In the same mockup, a component it places by name still takes none of the mockup's own styles, nor does anything inside it. | unit |
