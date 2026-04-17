---
name: chrome-devtools
description: Chrome DevTools MCP — browser automation, performance analysis, CrUX data, Lighthouse audits, debugging, and screenshots via a live Chrome instance
---

Chrome DevTools MCP gives you direct control of a live Chrome browser for debugging, performance analysis, and UI testing.

## When to Use

- **Performance analysis** — record traces, get CrUX field data, run Lighthouse audits
- **Visual debugging** — take screenshots, inspect the DOM, watch network requests
- **UI testing** — click, type, navigate, fill forms in a real browser
- **Network inspection** — see what requests are being made, check responses
- **Memory profiling** — take heap snapshots, find memory leaks

## Tools (31 total)

### Input Automation
- `click` — click an element by selector or coordinates
- `drag` — drag from one position to another
- `fill` — fill a single input field
- `fill_form` — fill multiple form fields at once
- `handle_dialog` — accept or dismiss browser dialogs
- `hover` — hover over an element
- `press_key` — press a keyboard key
- `type_text` — type text character by character
- `upload_file` — upload a file to a file input

### Navigation
- `navigate_page` — go to a URL
- `new_page` — open a new tab
- `close_page` — close a tab
- `list_pages` — list all open tabs
- `select_page` — switch to a tab
- `wait_for` — wait for a selector, navigation, or network idle

### Performance
- **`trace`** — record a performance trace. Returns timing data with CrUX field metrics for comparison. This is the primary performance tool.
- **`memory_snapshot`** — take a heap snapshot for memory analysis
- **`performance_insights`** — get performance insights from a trace
- **`crux`** — query Chrome User Experience Report data for a URL. Real-user field data — LCP, FID, CLS, TTFB, INP from actual Chrome users.

### Network
- `network_requests` — list network requests with status, size, timing
- `inspect_request` — get full details of a specific request (headers, body, response)

### Debugging
- `evaluate` — run JavaScript in the browser console
- `console_messages` — get console output (logs, warnings, errors)
- `screenshot` — take a screenshot of the current page or an element
- `lighthouse` — run a full Lighthouse audit (performance, accessibility, best practices, SEO)
- `accessibility_snapshot` — get the accessibility tree
- `emulate` — emulate a device (mobile, tablet) or network conditions (3G, offline)

### Page
- `resize_page` — resize the browser viewport

## Modes

- **Default** — all 31 tools available
- **`--slim`** — lightweight mode with 3 core tools only (for constrained contexts)
- **`--experimental-screencast`** — enables screen recording (requires ffmpeg)

## Patterns

### Performance audit workflow
1. `navigate_page` to the target URL
2. `trace` to record a performance trace
3. `crux` to get real-user field data for comparison
4. `lighthouse` for a full audit
5. Compare lab trace against CrUX field data to identify gaps

### Debug a UI issue
1. `navigate_page` to the page
2. `screenshot` to see current state
3. `console_messages` to check for errors
4. `network_requests` to verify API calls
5. `evaluate` to inspect DOM state or run diagnostics

### Test a user flow
1. `navigate_page` to the starting page
2. `fill_form` to enter data
3. `click` to submit
4. `wait_for` navigation or network idle
5. `screenshot` to verify the result

## vs Playwright

Both automate browsers. Use Chrome DevTools for:
- Performance traces and CrUX data (Playwright doesn't have this)
- Lighthouse audits
- Memory profiling
- Network inspection with full request/response details
- Working with an existing browser session

Use Playwright for:
- Automated test suites that run in CI
- Cross-browser testing (Firefox, WebKit)
- Headless testing at scale
