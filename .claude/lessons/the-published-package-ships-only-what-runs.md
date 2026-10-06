# The published package ships only what runs — source maps, build traces and generated types stay out of the tarball

`@infinitedusky/indusk-mcp` ships the admin pre-built (`scripts/bundle-admin.js` copies the admin's `.next/` into `admin/`). Copied whole, 1.63.0's first cut was 41.5 MB unpacked, and 26.7 MB of that was 160 source maps nobody runs, plus Next's build trace and generated types. Every install downloaded them.

What to do: when the bundle or the package's `files` change, check what `npm pack --dry-run --json` packs. The copy's `leftOut` rule names what stays out, and why. `admin-bundle-pack.test.ts` (system tier) refuses any `.map` file, `.next/trace`, `.next/trace-build` or `.next/types/` in the real tarball. Run `pnpm run prepublishOnly` first: `pnpm pack` does not build the bundle.
