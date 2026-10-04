# A rename is not a write until the data is flushed — write, fsync, rename, fsync the directory

The always-on server wrote its announced record by writing a temp file and renaming it over the live one, with a comment saying the rename made it safe. On its first real deploy, `fly machine restart` came thirty seconds after a pass wrote the record. The file came back from the ext4 volume with its name and zero bytes, because the rename had reached the disk and the data had not. The reader then refused, by design, and the server announced nothing from then on, while its heartbeat said it was listening.

Why it matters: write-then-rename protects against a process dying mid-write. It does not protect against a machine stopping before the page cache is flushed, and that is the failure a hosted machine meets routinely: restarts, deploys, host moves. The comment described a guarantee the code did not deliver, and no local test could show it, because a laptop process exiting normally flushes everything.

What to do: anything that must survive a machine stop goes through `writeFileDurably` (`lib/always-on/durable-write.ts`). It writes the temp file, `fsync`s it, renames it, then `fsync`s the directory. Test durability where machines actually stop: the deployed smoke restarts the machine and reads the records back (`deployed-smoke.e2e.test.ts`, A10).
