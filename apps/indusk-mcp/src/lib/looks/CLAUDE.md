# looks — rules for working in `lib/looks/`

Loaded by Claude Code when a file here is read. Each entry is a rule and a
pointer; the pointer holds the story.

- **A mockup is read composed, everywhere**: it is linted, shown, hashed and
  checked through `compose.ts` (each `<indusk-component>` replaced by its
  approved snapshot), never from its source bytes alone. Its approval binds
  `componentsHash`, so a changed component reopens exactly the mockups that use
  it. Guarded by `looks-components-cli.test.ts` (A11).
