# Replacing a page body with an early-return branch silently drops the shared frame's controls — give each control of the frame a row before restructuring the page

In plan-stories the master plan page was changed to an early-return branch for its new body, which dropped the shared frame's controls (trust notice, decision and amendment card, history, Ask about this plan). No row asserted them, so the loss was invisible from inside the build and the cold audit found it. Before a page's body is swapped or short-circuited, list what the shared frame draws and give each control a row (or one row that asserts all of them) on both branches. This was the second plan in a row (after cockpit-redraw) where the cold audit found the heaviest defect, which no row of the build could see.

Source: retro-lesson highlight h-20261015-010 (plan-stories).
