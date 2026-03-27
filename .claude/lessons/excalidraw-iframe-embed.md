# Excalidraw shareable URLs don't work in iframes

excalidraw.com shareable URLs with `#json=` fragments don't render diagram content when embedded in an iframe — the fragment isn't passed to the embedded page, so you get a blank editor. Use `@excalidraw/utils` `exportToSvg` for inline rendering instead. The library is browser-only (requires `window`), so use dynamic import inside `onMounted` in Vue/VitePress components.
