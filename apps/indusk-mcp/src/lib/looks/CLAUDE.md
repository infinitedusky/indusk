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
- **`approvals.ts` is the record and its reading; `approve.ts` is the write
  side**: `approve` and `withdraw` (with `approver`) live in `approve.ts`,
  behind the `./looks/approve` subpath, and only the admin's two routes import
  it; everything that reads a look's state imports `approvals.ts`, which
  exports no write. Guarded by `approvals.test.ts` (A38).
- **Every looks hash is computed in `mockups.ts`**: `sha256`, and
  `snapshotHash` / `stylesheetHash` for the two a story is bound by, called on
  the write side (the catalog, the sheet) and the read side alike — never a
  local `createHash`, so a hash written and a hash read cannot drift. Guarded
  by `stories.test.ts` (A37).
