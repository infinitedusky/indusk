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
| `raw-value` | a colour, size, space, radius, border, shadow, font or motion value that is not a token — the declaration whole, and a literal anywhere inside it: behind a function (`rgb(255 0 0)`, `calc(13px * 2)`, a gradient's stops), in a `var()` fallback, or in a custom property a mockup defines without declaring it new or an app defines outside its generated file |
| `undefined-token` | `var(--x)` where the foundation defines no `--x` |
| `undeclared-token` | a mockup defines `--x` and neither the foundation nor the mockup's `indusk-new-tokens` meta has it |
| `redefined-token` | a mockup, or an app stylesheet other than the generated one, gives a foundation token a value of its own (`:root { --color-dusk: #ff00ff }`) — the foundation is the one place a value is approved |
| `external-reference` | a mockup reaches outside itself: a `<link href>`, an `@import`, an `<img>`/`<script>`/`<iframe>` `src`, a `srcset`, a `poster`, or a `url()` that is not a `data:` URI or a `#fragment` — its approval binds only its own bytes. The generated `../tokens.css` is the foundation and passes |
| `stock-class` | a Tailwind colour, spacing step, radius, text size or shadow the foundation's theme does not define |
| `arbitrary-class` | a Tailwind arbitrary value such as `p-[13px]` |

**The properties held**: colour (`color`, `*-color`, `background`, `fill`,
`stroke`, `outline`), `margin*`, `padding*`, `gap`, `border` and each side and
width, `border-*-radius`, `width`, `height`, `inline-size`, `block-size`,
`inset*`, `top`/`right`/`bottom`/`left`, `outline-width`/`-offset`, `font` and
its size, family and weight, `line-height`, `letter-spacing`, `box-shadow`,
`text-shadow`, `transition*`, and an animation's duration, easing and delay.
A shorthand is judged by its longhands, so `border-left: var(--border-2) solid
var(--color-line)` passes. `min-*` and `max-*` sizes are not held yet — the
cockpit's reading measures (`70ch`) have no token.

**What passes**: `0`, `auto`, the CSS-wide keywords, `none`, `transparent`,
`currentColor`, a percentage, `vw`/`vh` (and `dvh`, `svh`, `lvh`, `vmin`,
`vmax`), `fr`, `min-`/`max-`/`fit-content`, and arithmetic on tokens
(`calc(100% - var(--space-4))`). A literal colour (hex or a colour function)
and a non-zero `px`, `rem`, `em`, `ms` or `s` do not, wherever they sit.

A mockup is read as the browser reads it (`parse5`): its `<style>` elements
and `style=""` attributes are its CSS, and a `<style>` inside a comment is not.

Exit 1 on any finding, 0 on none. A missing app or an unreadable foundation
exits 1 naming the file; it is never a clean app.

**Where each rule lives** (`src/lib/looks/`): the raw-value rule and the properties and units it holds in `lint-values`, the Tailwind class rules in `lint-classes`, the token checks (`undefined-token`, `undeclared-token`, `redefined-token`, `external-reference` in markup) and the orchestration in `lint`; a new rule gets a module of its own, not a place in `lint`.

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
			"declarationsHash": "65358e9c223f…",
			"by": "sandy",
			"at": "2026-10-10T09:00:00.000Z"
		}
	]
}
```

Each entry is bound to three sha256 hashes: the mockup's bytes, the
foundation's (`foundation.tokens.json`), and the **declarations** the check
trusts — the reference devices (`devices.json`), the `ignore` tags and the
`sources` (`screens.json`), read as key-sorted JSON so reformatting a file
binds the same. A mockup is **approved** while an entry holds all three
current hashes; otherwise it is **proposed**. So a change to an approved
mockup, to the foundation, or to a device's size, an ignored tag or the
source list returns it to proposed by itself, and an entry copied or typed
into the record with the wrong hashes approves nothing. An entry that binds no
declarations — every entry written before they were bound — reads proposed
until a person approves it again. Until a person approves the change, the app
is held to the last approved version on the foundation and declarations as
they are now, which `status` names.

An approval binds **what the person was shown**: Approve sends the hash of the
mockup the page drew and of the foundation it drew it on, and a mockup or a
foundation that changed since — on disk between the page's read and the
press — is refused, naming both hashes.

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

What refuses every other way in:

- `indusk looks approve` exits 2 and writes nothing, naming the cockpit's
  Approve. A command an agent can run is not a person's approval.
- The `looks-approval-guard` hook refuses an agent's Write or Edit to any
  `.indusk/mockups/<app>/approved.json`, and an agent's Bash command that
  writes it — a redirect onto it, `tee`, `cp`/`mv`, `sed -i`, an interpreter's
  `-e`, `git checkout <ref> -- …` — or calls the approve route. It reads the
  path or the command's text, never the file.
- The approve route answers only the person's browser on the admin's own
  page: on top of the admin's host and origin check, it requires
  `Sec-Fetch-Site: same-origin`, which the browser sets and page script
  cannot, and which `curl` does not send.

**What this does not make impossible.** The hook is a tripwire for an agent's
ordinary attempt, not a boundary: a script that builds the path or the URL at
run time passes it, and a process running as the person can send any header.
Nothing on the person's machine can be made unforgeable by something running
as them. What holds past the tripwire is the record itself — an entry reads
approved only while its hashes are the mockup, foundation and declarations as
they are — and that the record is in git, where a forged entry is a visible
commit by whoever made it. A person editing the record by hand is theirs to
do, and it holds only when its hashes are true.

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
hash characters: the reference the app is held to meanwhile — or, when that
version was approved on another foundation or other declarations, says
`last approved … — nothing held`. Exit 0; a missing
app or an unreadable record exits 1 naming the file.

## `indusk looks coverage <app>`

Every part of the UI needs an approved mockup. Coverage reads the screens and
states `screens.json` declares, and the `data-component="<name>"` attributes in
the app's declared sources, and names what no approved mockup covers:

```
uncovered screen: detail
uncovered state: home.full
uncovered component: badge
unresolved component: src/Dynamic.jsx:2
```

| Line | When |
|------|------|
| `uncovered screen: <name>` | none of the screen's declared states has an approved mockup |
| `uncovered state: <screen>.<state>` | the screen has an approved state, but not this one |
| `uncovered component: <name>` | the app renders it and no approved mockup shows it on an element |
| `unresolved component: <file>:<line>` | a source's `data-component={…}` is not a string literal, so no mockup can be said to cover it |

Only a mockup approved as it is now covers anything, and only with an element
that carries the name: a mockup is parsed as HTML, so `data-component="badge"`
in its comment, script or style is text and covers nothing. A source's name is
read when written literally — `data-component="badge"`, `'badge'`, `{"badge"}`
— and listed `unresolved` when computed, never ignored. Exit 1 when anything is
uncovered or unresolved, 0 when every part is covered.

## `indusk looks check <app> [--url <url>]`

Holds the running app to what a person approved, by value, in a real Chromium.
`--url` is the app's base URL; without it the check uses `url` in the app's
`screens.json`, and with neither it refuses rather than guess. A screen is
opened at `<url><path>?state=<state>`, where `path` is the screen's own `path`
in `screens.json` and otherwise `/<name>`.

For each declared screen state whose mockup is approved — or whose last
approved version was approved on the foundation and declarations as they are
now — at each device in `devices.json`, in each colour scheme, the check opens
the page and first asks it two questions:

- **Did it draw this state?** The page says which screen states it drew with
  `data-look-state` — a space-separated list of `<screen>.<state>` names, on
  `<html>` or on any element (several screens can share one page). A page that
  does not name the state is `unchecked … — the page did not report state
  <state>`, never held: a value check of a page that is not the state says
  nothing about the state. The cockpit reports `dashboard.default`,
  `dashboard.empty`, `looks.default` and `looks.uncovered`; its nav, promise
  and plan states are unchecked until it can.
- **Did it draw this scheme?** When any foundation token names a dark value,
  each look is opened in light and in dark (`colorScheme: dark`) and reported
  under `phone` and `phone/dark`. Dark is judged against each token's dark
  value. A page that pins itself light (`data-theme="light"`) when opened dark
  is `unchecked … @ phone/dark — the page did not render the dark scheme`.

Then it decides two things:

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
unchecked home.full @ phone — the page did not report state full
unchecked detail.default — proposed, never approved
admin: 12 looks held, 54 unchecked
```

Elements the check does not draw are named in `screens.json`'s `ignore` (tag
names, such as `nextjs-portal` in development); a margin of `auto` is read as
the keyword, not the pixels it resolved to; a shadow is read layer by layer, in
whatever colour spelling, and a framework's empty layer is not a break.

A proposed mockup is not checked against (`unchecked`, with the reason), and
the closing line counts unchecked looks beside held and broken. Each look is
also recorded as a span, one per screen × state × device and scheme, carrying a
promise's mark under `tokens-are-held-exactly` — `upheld` when held,
`violated` with the first finding as the symptom when broken — so a look reads
beside promises in the health reader.

Exit 1 on any broken look, and when nothing could be checked: a run that
checked nothing is not a held look. `playwright-core` is an optional
dependency; without it, or without Chromium, the command refuses by name and
says what to install. Because it opens a browser it runs in the system tier,
never in the everyday suite.
