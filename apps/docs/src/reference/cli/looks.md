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

## Approval

A mockup is the reference the app is held to only when a person has approved
it. The record is `.indusk/mockups/<app>/approved.json`:

```json
{
	"approvals": [
		{
			"mockup": "home.empty",
			"mockupHash": "3293523189dd…",
			"foundationHash": "ab91330460fb…",
			"by": "sandy",
			"at": "2026-10-10T09:00:00.000Z"
		}
	]
}
```

Each entry is bound to the sha256 of the mockup's bytes and of
`foundation.tokens.json`'s. A mockup is **approved** while an entry holds both
of its current hashes; otherwise it is **proposed**. So a change to an
approved mockup, or to the foundation, returns it to proposed by itself, and
an entry copied or typed into the record with the wrong hashes approves
nothing. Until a person approves the change, the app is held to the last
approved version, which `status` names.

### Why `approve` is the cockpit's

An agent can draw and propose a mockup; only a person approves one. The
approval is given in the cockpit, on the app's Looks page, with Approve — the
admin calls `approve` from `@infinitedusky/indusk-mcp/looks/approvals` with the
person who pressed it, appends the entry, and commits the record on the branch
of the checkout the page showed — a plan's worktree commits on the plan's
branch, so the approval merges with the mockups it judges and never goes
through `main` — through the same notes writer the plan history uses, only
that file. Several proposed mockups can be selected and approved together:
each is its own entry, bound to its own hash, as the person who clicked.

Two things refuse every other way in:

- `indusk looks approve` exits 2 and writes nothing, naming the cockpit's
  Approve. A command an agent can run is not a person's approval.
- The `looks-approval-guard` hook refuses an agent's Write or Edit to any
  `.indusk/mockups/<app>/approved.json`, before it lands. It judges the path
  named, never the file. A write through the shell is out of its sight; there
  the hash binding is what holds.

A person editing the record by hand is theirs to do — and it holds only when
its hashes are true.

## `indusk looks tokens <app> [--tailwind] [--out <file>]`

The foundation as CSS: `:root` custom properties for a mockup, with dark-scheme
values (a token's `$extensions["dev.indusk"].dark`) under
`prefers-color-scheme: dark` and `[data-theme="dark"]`. With `--tailwind` it
writes an `@theme static` block that resets Tailwind's stock theme to the
foundation, so a stock class has nothing to compile to; a token in a mapped
group (`space`, `size`, `easing`) is written under Tailwind's name and the
foundation's own. `--out` writes the file, relative to the project root — an
app commits it beside its source (`apps/indusk-admin/src/app/foundation.generated.css`).

## `indusk looks status <app>`

One line per mockup:

```
detail.default  proposed  never approved
home.empty  approved  by sandy at 2026-10-10T09:00:00.000Z
home.full  proposed  held to 00000000 (approved by sandy at 2026-10-10T09:05:00.000Z)
```

A proposed mockup with an approved version names that version's first eight
hash characters: the reference the app is held to meanwhile. Exit 0; a missing
app or an unreadable record exits 1 naming the file.

## `indusk looks coverage <app>`

Every part of the UI needs an approved mockup. Coverage reads the screens and
states `screens.json` declares, and the `data-component="<name>"` attributes in
the app's declared sources, and names what no approved mockup covers:

```
uncovered screen: detail
uncovered state: home.full
uncovered component: badge
```

| Line | When |
|------|------|
| `uncovered screen: <name>` | none of the screen's declared states has an approved mockup |
| `uncovered state: <screen>.<state>` | the screen has an approved state, but not this one |
| `uncovered component: <name>` | the app renders it and no approved mockup shows it |

Only a mockup approved as it is now covers anything. A component name is read
when written literally — `data-component="badge"`, `'badge'`, `{"badge"}` — not
when computed. Exit 1 when anything is uncovered, 0 when every part is.

## `indusk looks check <app> [--url <url>]`

Holds the running app to what a person approved, by value, in a real Chromium.
`--url` is the app's base URL; without it the check uses `url` in the app's
`screens.json`, and with neither it refuses rather than guess. A screen is
opened at `<url><path>?state=<state>`, where `path` is the screen's own `path`
in `screens.json` and otherwise `/<name>`.

For each declared screen state whose mockup is approved — or whose last
approved version was approved on the foundation as it is now — at each device
in `devices.json`, the check measures the page and decides two things:

| Check | Held when | A broken line names |
|-------|-----------|---------------------|
| Tokens | each foundation token read from `:root` equals its approved value | the token, approved and actual |
| Elements | each element's colour, length, radius, shadow, font, `transition-duration` and `transition-timing-function` is one of the approved values of its kind | the element, the property, the actual value and the nearest token |

A token changed in the app alone breaks the token and, through every element
that uses it, each of those elements. A duration or an easing is held to its
approved value like a colour or a size. The browser's own initial values — a
zero length, no shadow, no transition, a transparent background — are never a
break.

```
held    home.empty @ phone
broken  home.empty @ desktop
  token --color-dusk approved #c2620b actual #c2620c
  element button.primary background-color actual rgb(194, 98, 12) nearest --color-dusk (#c2620b)
unchecked detail.default — proposed, never approved
```

Elements the check does not draw are named in `screens.json`'s `ignore` (tag
names, such as `nextjs-portal` in development); a margin of `auto` is read as
the keyword, not the pixels it resolved to; a shadow is read layer by layer, in
whatever colour spelling, and a framework's empty layer is not a break.

A proposed mockup is not checked against (`unchecked`, with the reason). Each
look is also recorded as a span, one per screen × state × device, carrying a
promise's mark under `tokens-are-held-exactly` — `upheld` when held,
`violated` with the first finding as the symptom when broken — so a look reads
beside promises in the health reader.

Exit 1 on any broken look, and when nothing could be checked: a run that
checked nothing is not a held look. `playwright-core` is an optional
dependency; without it, or without Chromium, the command refuses by name and
says what to install. Because it opens a browser it runs in the system tier,
never in the everyday suite.
