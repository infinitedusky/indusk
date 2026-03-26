# Always add new docs pages to the sidebar

When you create a new documentation page, you must also add it to the VitePress sidebar configuration in `.vitepress/config.ts`. If you don't, the page exists but is invisible — no one can navigate to it.

This is the single most common documentation mistake. The page is written, the content is good, but it's orphaned because the sidebar wasn't updated.

The fix is simple: every time you create a page, immediately open `.vitepress/config.ts` and add the entry to the correct sidebar section. Do it in the same edit, not as a follow-up.
