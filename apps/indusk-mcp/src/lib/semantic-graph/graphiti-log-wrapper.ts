/**
 * Graphiti capture wrapper for the semantic graph.
 *
 * Dual-writes: calls GraphitiClient.addEpisode() for knowledge extraction,
 * then appends an edge.attached event to the semantic graph log so the
 * capture is visible in the unified graph.
 *
 * The wrapper resolves a file path (if provided) to an anchor UUID in the
 * runtime graph. If no path is provided or the path doesn't match an anchor,
 * attaches to a synthetic project-root anchor.
 */

import { randomUUID } from "node:crypto";

import type { GraphitiClient } from "../graphiti-client.js";
import { getScm } from "../scm/detect.js";
import { getCurrentChangeId } from "../scm/index.js";
import type { EdgeAttachedEvent } from "./events.js";
import type { LogWriter } from "./log-writer.js";
import type { SemanticGraphClient } from "./runtime-client.js";

/**
 * Module-level flag — emit the "git mode — semantic graph unavailable"
 * warning once per process. captureWithLog is called on every Graphiti
 * write, so a per-call warning would saturate stderr.
 */
let warnedGitMode = false;

function warnOnceGitMode(): void {
	if (warnedGitMode) return;
	warnedGitMode = true;
	process.stderr.write(
		"git mode — semantic graph unavailable; Graphiti writes still succeed but are not mirrored to the event log (jj-only feature in v1)\n",
	);
}

export interface CaptureOptions {
	/** File path this capture relates to (for anchor resolution). */
	filePath?: string;
	/** Graphiti group ID override. Defaults to project name. */
	groupId?: string;
	/** Source type for Graphiti. */
	source?: string;
	/** Source description for Graphiti. */
	sourceDescription?: string;
	/** Relation label for the edge. Defaults to "knowledge". */
	relation?: string;
}

export interface CaptureResult {
	graphitiSuccess: boolean;
	edgeWritten: boolean;
	edgeUuid?: string;
	anchorUuid?: string;
}

const PROJECT_ROOT_ANCHOR_KIND = "file";
const PROJECT_ROOT_PATH = ".";

/**
 * Wraps Graphiti episode capture with a semantic graph log write.
 *
 * Call this instead of GraphitiClient.addEpisode() directly when you want
 * the capture to also appear in the semantic graph.
 */
export async function captureWithLog(
	name: string,
	body: string,
	projectRoot: string,
	graphiti: GraphitiClient,
	logWriter: LogWriter,
	runtimeClient: SemanticGraphClient,
	options: CaptureOptions = {},
): Promise<CaptureResult> {
	// 1. Write to Graphiti first
	const graphitiResult = await graphiti.addEpisode(name, body, {
		groupId: options.groupId,
		source: options.source,
		sourceDescription: options.sourceDescription,
	});

	const graphitiSuccess = graphitiResult?.success ?? false;

	if (!graphitiSuccess) {
		// Graphiti failed — still try to write the edge to the log
		// so the capture is at least recorded locally
	}

	// Graceful-degrade on git mode: Graphiti write above still succeeded;
	// we just skip mirroring to the semantic graph event log. Returns the
	// Graphiti outcome but no edge data. See sync-engine.ts for the full
	// rationale.
	if (getScm(projectRoot) === "git") {
		warnOnceGitMode();
		return { graphitiSuccess, edgeWritten: false };
	}

	// 2. Resolve anchor UUID
	let anchorUuid: string | undefined;

	if (options.filePath) {
		anchorUuid = await resolveFileAnchor(runtimeClient, options.filePath);
	}

	if (!anchorUuid) {
		// Fall back to project-root anchor — create if missing
		anchorUuid = await ensureProjectRootAnchor(projectRoot, logWriter, runtimeClient);
	}

	// 3. Write edge.attached to log
	let edgeWritten = false;
	let edgeUuid: string | undefined;

	try {
		const changeId = await getCurrentChangeId(projectRoot);
		edgeUuid = randomUUID();

		const event: EdgeAttachedEvent = {
			type: "edge.attached",
			edge_uuid: edgeUuid,
			source_uuid: randomUUID(), // the Graphiti episode (external, UUID is a reference marker)
			target_uuid: anchorUuid,
			relation: options.relation ?? "knowledge",
			payload: {
				name,
				source: options.source ?? "text",
				source_description: options.sourceDescription ?? "",
				graphiti_success: graphitiSuccess,
			},
			change_id: changeId,
			ts: new Date().toISOString(),
		};

		await logWriter.append(event);
		await runtimeClient.applyEvent(event);
		edgeWritten = true;
	} catch {
		// Best-effort — don't fail the capture if edge writing fails
		edgeWritten = false;
	}

	return { graphitiSuccess, edgeWritten, edgeUuid, anchorUuid };
}

/** Look up a file anchor by path in the runtime graph. */
async function resolveFileAnchor(
	client: SemanticGraphClient,
	filePath: string,
): Promise<string | undefined> {
	try {
		const anchors = await client.queryAnchors({ status: "active" });
		const match = anchors.find((a) => a.kind === "file" && a.path === filePath);
		return match?.uuid;
	} catch {
		return undefined;
	}
}

/** Ensure a project-root anchor exists. Creates one if missing. */
async function ensureProjectRootAnchor(
	projectRoot: string,
	logWriter: LogWriter,
	client: SemanticGraphClient,
): Promise<string> {
	// Check if it already exists
	try {
		const anchors = await client.queryAnchors({ status: "active" });
		const existing = anchors.find(
			(a) => a.kind === PROJECT_ROOT_ANCHOR_KIND && a.path === PROJECT_ROOT_PATH,
		);
		if (existing) return existing.uuid;
	} catch {
		// Fall through to create
	}

	// Create it
	const uuid = randomUUID();
	const changeId = await getCurrentChangeId(projectRoot);

	const event = {
		type: "anchor.created" as const,
		uuid,
		kind: "file" as const,
		path: PROJECT_ROOT_PATH,
		name: "project-root",
		adapter: "graphiti-wrapper",
		change_id: changeId,
		ts: new Date().toISOString(),
	};

	await logWriter.append(event);
	await client.applyEvent(event);
	return uuid;
}
