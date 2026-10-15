# In HTML a custom element written self-closing (`<x-y />`) is not self-closing — the parser nests every following sibling inside it; a reader of custom-element markup must end a hyphenated self-closing tag at its start tag, and a lint must not report the siblings as its content

component-content's reader and lint treated `<indusk-component name="x" />` as an empty element. HTML does not: only void elements self-close, so a parser nests every following sibling inside the custom element, and the lint reported those siblings as content placed inside the component (a false violation of "placed content is only words and components").

Why: the HTML parser ignores the trailing slash on non-void elements; the markup we author for mockups is HTML, not XML.

What to do: any reader or lint of our custom-element markup (mockups, snapshots) must end a hyphenated tag that is written self-closing at its start tag when computing its content, and must have a test with a self-closing component followed by sibling text or components, asserting the siblings are not its content. Prefer writing `<indusk-component name="x"></indusk-component>` in generated markup so a stock HTML parser agrees with ours.

See component-content's retrospective (retro-lesson highlight, 2026-10-14).
