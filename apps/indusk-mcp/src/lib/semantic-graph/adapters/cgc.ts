/**
 * CGC adapter for the semantic graph sync engine.
 *
 * Reads File, Function, Class, and Interface nodes from the CGC structural
 * graph (`cgc-{project}`) and projects them as AdapterRecords. Also queries
 * intra-codebase IMPORTS edges (relative specifiers only) and returns them
 * as import relationships to be projected as edge.attached events.
 *
 * External dependencies (npm packages, node:* builtins) are excluded —
 * only imports starting with "./" or "../" are projected.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { FalkorDB } from "falkordb";

import type { AdapterEdge, AdapterRecord, SemanticGraphAdapter } from "../adapter.js";

export interface CgcAdapterOptions {
	host?: string;
	port?: number;
}

/**
 * Resolve a relative import specifier to a file path.
 *
 * Handles: `./foo` → `dir/foo.ts`, `../lib/bar.js` → resolved path.
 * Tries extensions in order: exact match (if has extension), `.ts`, `.js`,
 * `/index.ts`, `/index.js`.
 */
function resolveImportSpecifier(
	importerPath: string,
	specifier: string,
	knownPaths: Set<string>,
): string | undefined {
	const dir = dirname(importerPath);
	const base = resolve(dir, specifier);

	// If the specifier already has an extension, try it and strip-and-retry
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}.js`,
		`${base}.jsx`,
		`${base}/index.ts`,
		`${base}/index.js`,
	];

	// Also try stripping .js extension and replacing with .ts (common in TS projects)
	if (base.endsWith(".js")) {
		const stripped = base.slice(0, -3);
		candidates.push(`${stripped}.ts`, `${stripped}.tsx`);
	}

	for (const candidate of candidates) {
		if (knownPaths.has(candidate)) return candidate;
	}
	return undefined;
}

export class CgcAdapter implements SemanticGraphAdapter {
	readonly name = "cgc";
	private readonly host: string;
	private readonly port: number;

	private _edges: AdapterEdge[] = [];

	constructor(options: CgcAdapterOptions = {}) {
		this.host = options.host ?? "localhost";
		this.port = options.port ?? 6379;
	}

	async snapshot(projectRoot: string): Promise<AdapterRecord[]> {
		const projectName = basename(projectRoot);
		const graphName = `cgc-${projectName}`;

		const db = await FalkorDB.connect({
			socket: { host: this.host, port: this.port },
		});

		try {
			const graph = db.selectGraph(graphName);
			const records: AdapterRecord[] = [];

			// Query File nodes
			const files = await graph.query<{ path: string }>("MATCH (f:File) RETURN f.path AS path");

			const filePaths = new Set<string>();
			const filePathList: string[] = [];
			for (const row of files.data ?? []) {
				const path = String(row.path);
				filePaths.add(path);
				filePathList.push(path);
			}

			// Batch hash all files in one subprocess call
			const blobHashes = this.getBlobHashes(filePathList);

			for (const path of filePathList) {
				const blobHash = blobHashes.get(path);
				records.push({
					kind: "file",
					path,
					metadata: blobHash ? { blob_hash: blobHash } : undefined,
				});
			}

			// Query symbol nodes (Function, Class, Interface)
			for (const kind of ["Function", "Class", "Interface"] as const) {
				const kindLower = kind.toLowerCase() as "function" | "class" | "interface";
				const symbols = await graph.query<{ name: string; path: string }>(
					`MATCH (f:File)-[:CONTAINS]->(s:${kind}) RETURN s.name AS name, f.path AS path`,
				);

				for (const row of symbols.data ?? []) {
					records.push({
						kind: kindLower,
						path: String(row.path),
						name: String(row.name),
						parent_identity: `file::${row.path}`,
					});
				}
			}

			// Query internal IMPORTS edges
			const imports = await graph.query<{
				importer_path: string;
				specifier: string;
			}>(
				`MATCH (f:File)-[:IMPORTS]->(m:Module)
				 WHERE m.name STARTS WITH './' OR m.name STARTS WITH '../'
				 RETURN f.path AS importer_path, m.name AS specifier`,
			);

			this._edges = [];
			for (const row of imports.data ?? []) {
				const importerPath = String(row.importer_path);
				const specifier = String(row.specifier);
				const resolved = resolveImportSpecifier(importerPath, specifier, filePaths);
				if (resolved) {
					this._edges.push({
						source_identity: `file::${importerPath}`,
						target_identity: `file::${resolved}`,
						relation: "imports",
					});
				}
				// Unresolvable specifiers silently skipped — deleted files, index re-exports, etc.
			}

			return records;
		} finally {
			await db.close();
		}
	}

	identify(record: AdapterRecord): string {
		if (record.kind === "file") return `file::${record.path}`;
		return `${record.kind}::${record.path}::${record.name ?? ""}`;
	}

	edges(): AdapterEdge[] {
		return this._edges;
	}

	contentFingerprint(record: AdapterRecord): string | undefined {
		if (record.kind === "file") {
			return (record.metadata?.blob_hash as string) ?? undefined;
		}
		// Symbols don't support rename detection in v1
		return undefined;
	}

	private getBlobHashes(filePaths: string[]): Map<string, string> {
		const result = new Map<string, string>();
		if (filePaths.length === 0) return result;

		// Filter to files that actually exist — CGC index may reference stale paths
		const existing = filePaths.filter((p) => existsSync(p));
		if (existing.length === 0) return result;

		try {
			const stdout = execFileSync("git", ["hash-object", "--stdin-paths"], {
				input: existing.join("\n"),
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			const hashes = stdout.trim().split("\n");
			for (let i = 0; i < existing.length && i < hashes.length; i++) {
				const hash = hashes[i].trim();
				if (hash.length > 0) {
					result.set(existing[i], hash);
				}
			}
		} catch {
			// Failed to hash — return empty map, files will have no fingerprint
		}

		return result;
	}
}
