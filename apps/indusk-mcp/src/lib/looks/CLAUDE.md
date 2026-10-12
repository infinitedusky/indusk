# looks — rules for working in `lib/looks/`

Loaded by Claude Code when a file here is read. Each entry is a rule and a
pointer; the pointer holds the story.

- **A mockup is read composed, everywhere**: it is linted, shown, hashed and
  checked through `compose.ts` (each `<indusk-component>` replaced by its
  approved snapshot), never from its source bytes alone. Its approval binds
  `componentsHash`, so a changed component reopens exactly the mockups that use
  it. Guarded by `looks-components-cli.test.ts` (A11).
- **A story's approval binds its snapshot and its component's stylesheet; a
  mockup is approved only while every story it composes is**: a rule changed
  in the app's CSS leaves the markup byte-identical, so `stylesheetHash` is
  bound beside `snapshotHash`, and an Approve sends both (a composed mockup's
  sends `componentsHash`, never optional). `approvalOf` reads the story
  approvals, so status, coverage, the check and the overview agree with the
  lint. Guarded by `looks-components-cli.test.ts` (A31, A32).
