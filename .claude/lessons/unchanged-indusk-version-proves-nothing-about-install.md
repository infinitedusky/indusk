# An unchanged `indusk --version` proves nothing about a landing install — the version moves only at a release, so verify an install by its content, not its number

A landing install was believed to have failed because `indusk --version` still read 1.70.0. In fact landing runs `pnpm install:local` and the version only changes at `indusk release`. To check an install, compare something the landed build changed (a hook's bytes, a skill's text, a command's new flag), not the version string.

Source: retro-lesson highlight h-20261015-004 (a contradiction caught during a retrospective).
