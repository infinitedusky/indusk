import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Replace `path` with `content` so that a machine stopped at any moment leaves
 * either the old file or the new one — never an empty one.
 *
 * Write-then-rename alone is not that. The rename is a metadata change and can
 * reach the disk before the file's data does; ext4 then shows the new name
 * with zero bytes after a crash. The always-on server's first real deploy hit
 * exactly this: `fly machine restart` thirty seconds after a pass wrote
 * `announced.json` left it empty, and every pass after refused to announce
 * anything (day-always-on-deploy, 2026-10-04). So: write the temp file and
 * flush it, rename, then flush the directory that holds the new name.
 *
 * Every byte, too: on a nearly full volume `write(2)` returns short rather
 * than failing, and a single unchecked write renamed a truncated record over
 * the good one (A16). A write that fails removes its temp file and leaves the
 * old record where it was.
 *
 * `mode` is the new file's permission, before the umask: a secrets file passes
 * `0o600`, so the file is never readable by others even for an instant.
 */
export function writeFileDurably(path: string, content: string, mode = 0o666): void {
	const dir = dirname(path);
	mkdirSync(dir, { recursive: true });
	const temp = `${path}.${process.pid}.tmp`;
	const fd = openSync(temp, "w", mode);
	try {
		writeAll(fd, Buffer.from(content, "utf-8"));
		fsyncSync(fd);
	} catch (err) {
		closeSync(fd);
		rmSync(temp, { force: true });
		throw err;
	}
	closeSync(fd);
	renameSync(temp, path);
	const dirFd = openSync(dir, "r");
	try {
		fsyncSync(dirFd);
	} finally {
		closeSync(dirFd);
	}
}

function writeAll(fd: number, bytes: Buffer): void {
	let written = 0;
	while (written < bytes.length) {
		const n = writeSync(fd, bytes, written, bytes.length - written);
		if (n <= 0) throw new Error(`wrote nothing after ${written} of ${bytes.length} bytes`);
		written += n;
	}
}
