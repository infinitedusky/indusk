# The release prints what a person must read — its failure, its warnings and the 2FA prompt — not one line per packed file

`npm publish` logs the tarball's contents at `notice` level, one line per file. For 1.63.0 that was over a thousand lines, and the line naming the release's failure scrolled out of the terminal.

What to do: the `release` script publishes with `npm_config_loglevel=warn`. Warnings and errors still print. So does the 2FA prompt, because npm writes it with `output.standard`, which no loglevel gates (`lib/utils/open-url.js`, npm 11). Keep the setting on any new publish step. `release-script.test.ts` refuses a `release` script whose publish runs without it, or whose steps changed.
