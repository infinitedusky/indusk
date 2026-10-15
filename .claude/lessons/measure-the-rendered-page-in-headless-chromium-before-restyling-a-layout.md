# When a layout looks wrong, measure the rendered page in headless Chromium before changing any CSS — a dev server can serve a stale stylesheet

Measure column widths, tops and bottoms (and which stylesheet is loaded) in a headless browser first; restyle only against numbers.

Why: in brief-as-the-contract the brief page's agent column was "wrong" over two rounds of restyling (side, width, height, border) that were chasing a stale stylesheet the Turbopack dev server kept serving after a restart; one headless measurement settled it. Each round also cost a person's look at the page and several commits.

How to apply: before the second CSS change to the same element, run the page in Playwright/Chromium and read `getBoundingClientRect` and the computed styles; restart the dev server and hard-reload to rule out a cached sheet. Record the measured values in the commit body. See `.indusk/planning/brief-as-the-contract/retrospective.md` ('Getting to Done').
