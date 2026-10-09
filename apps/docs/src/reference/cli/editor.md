# editor

The InDusk extension for VS Code and Cursor. See [Promises in your editor](/guide/promises-in-your-editor) for what it shows.

## `indusk editor install`

```bash
indusk editor install [--extensions-dir <dir>]
```

Installs the extension that ships inside the `@infinitedusky/indusk-mcp` package (`editor/indusk.vsix`) into every editor whose command it finds:

| Editor | Command it looks for |
|---|---|
| VS Code | `code` |
| Cursor | `cursor` |

It says which editors it installed into. Run it again after updating InDusk to install the extension that came with the update.

When neither command is on your `PATH`, it says how to get VS Code's: in VS Code, run **Shell Command: Install 'code' command in PATH** from the Command Palette. It exits `2` and installs nothing.

| Option | Meaning |
|---|---|
| `--extensions-dir <dir>` | Install into this extensions folder instead of the editor's own. Used by tests. |

| Exit | Meaning |
|---|---|
| `0` | Installed into every editor found. |
| `1` | An editor refused the install; its message is printed. |
| `2` | No extension package, or no editor command found. |

The extension activates only in a folder with `.indusk/config.json`. It starts one `indusk promises health --json --every 5` per window; the `indusk.command` setting names a different `indusk` when the one on `PATH` is not the project's.
