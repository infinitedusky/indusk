---
title: "New components draw in their mockups"
date: 2026-10-17
status: draft
workflow: bugfix
description: "A component a mockup declares new and draws itself is styled by that mockup again in the cockpit. Since 2026-10-17 the cockpit kept a mockup's own styles off every component, so every new component drawn inline showed as bare text."
---

# New components draw in their mockups — Brief

Seen 2026-10-17 drawing `ideas-wait-their-turn`'s mockups: `draft-row.aged`,
already on `main`, draws as bare text in the cockpit. The page-only scoping
that `mockups-draw-components-as-stories` added keeps a mockup's own `<style>`
off every element marked as a component. That is right for a component the
mockup places by name, whose look is its story's; it is wrong for a component
the mockup declares new (`<meta name="indusk-new-components">`) and draws
itself, whose only look is that mockup's styles.

## Expectations

None — a regression fix; the promise below is its measure.

## Promises

### This plan makes

None.

### Existing promises

**Must not break**

- **`mockups-render-in-the-cockpit`**. A mockup's new components draw with its own styles again, and a component it places still draws as its story does.

**Changes**

None.

**Replaces**

None.

### Not promised

- Re-approving the new-component mockups approved since the scoping landed. They draw as they did before it.

## Looks

None — the fix is in how the package composes a mockup for the cockpit; no screen of the admin changes.
