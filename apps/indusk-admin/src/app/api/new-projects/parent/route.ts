import { induskHome, setParent } from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where new projects go (new-project-flow, ADR decision 6): `{ parent }`, an
 * absolute folder or one starting `~`. The package keeps it - the same setting
 * `indusk new-project parent` writes - so the start page can ask for it and a
 * project can be made with no command typed. A relative path is refused: it
 * would mean the daemon's own folder, which is not where the person looks.
 *
 * promise: a-new-project-is-written-only-under-its-parent
 */
export async function POST(request: NextRequest): Promise<Response> {
	const refused = adminOnly(request, "where new projects go is set only from the admin's own page");
	if (refused) return refused;
	const body = (await request.json().catch(() => null)) as {
		parent?: unknown;
	} | null;
	const dir = typeof body?.parent === "string" ? body.parent.trim() : "";
	if (dir === "") return refuse(400, "name the folder new projects go in");
	if (!(dir.startsWith("/") || dir === "~" || dir.startsWith("~/"))) {
		return refuse(400, `${dir} is not an absolute folder: start it with / or ~`);
	}
	try {
		return Response.json({ parent: setParent(dir, induskHome(), "admin") });
	} catch (err) {
		return refuse(400, (err as Error).message);
	}
}
