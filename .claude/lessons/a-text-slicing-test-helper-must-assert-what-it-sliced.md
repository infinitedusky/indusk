# A test helper that slices a section out of a document must assert the slice is non-trivial — a cutter that returns one character makes every assertion on it meaningless

admin-plan-worktrees' A18 read the retrospective skill's "### Step 10" section and asserted the order of three commands in it. The helper searched for the next heading starting one character into the current one, so the end pattern `^## ` matched `## Step 10` itself and the section was one character long. The work-skill half of the same test passed only because its heading level happened not to collide.

How to apply: every structural slicer in a test (section by heading, block by fence, table by header) either asserts a minimum size or asserts a known marker inside the slice before the real assertions run. Search for the end boundary from after the start line, never from one character in.
