# `indusk looks`

An app's look, held the way a promise is held: mockups on one foundation of
design tokens, a rule that nothing in them or in the app is a raw value. The
design is [UI promises](/decisions/ui-promises).

## The foundation

Each app keeps its look under `.indusk/mockups/<app>/`:

```
.indusk/mockups/admin/
├── foundation.tokens.json   # the DTCG file every visual value comes from
├── devices.json             # the reference devices
├── screens.json             # the screens, their states, and the app's source directories
└── screens/home.empty.html  # one mockup per screen × state
```

`foundation.tokens.json` is a [DTCG 2025.10](https://www.designtokens.org/)
file. The types it may use are `color`, `dimension`, `fontFamily`,
`fontWeight`, `shadow`, `duration` and `cubicBezier`; a token of any other
type is refused by name. A token's CSS custom property is its path joined with
`-`: `space.3` is `--space-3`, `color.paper` is `--color-paper`.

A mockup that needs a token the foundation lacks declares it new, and only
then is it accepted:

```html
<meta name="indusk-new-tokens" content="--shadow-lift, --space-5" />
```

## `indusk looks lint <app>`

Reads the app's mockups and the source directories `screens.json` names, and
prints one finding per line:

```
src/Badge.jsx:3  p-[13px]  arbitrary-class — arbitrary value in p-[13px] — use a class from the foundation's theme
```

| Rule | What it names |
|------|---------------|
| `raw-value` | a colour, size, space, radius, shadow, font or motion declaration that is not a token (`0`, `auto` and the CSS keywords pass) |
| `undefined-token` | `var(--x)` where the foundation defines no `--x` |
| `undeclared-token` | a mockup defines `--x` and neither the foundation nor the mockup's `indusk-new-tokens` meta has it |
| `stock-class` | a Tailwind colour, spacing step, radius, text size or shadow the foundation's theme does not define |
| `arbitrary-class` | a Tailwind arbitrary value such as `p-[13px]` |

Exit 1 on any finding, 0 on none. A missing app or an unreadable foundation
exits 1 naming the file; it is never a clean app.
