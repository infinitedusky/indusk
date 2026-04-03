import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface InfraConfig {
	falkordb: { host: string; port: number };
	graphiti: { url: string };
}

export function getInfraConfig(): InfraConfig {
	// Override: hosted endpoint
	const infraUrl = process.env.INDUSK_INFRA_URL;
	if (infraUrl) {
		return {
			falkordb: { host: infraUrl, port: 6379 },
			graphiti: { url: `http://${infraUrl}:8100/mcp/` },
		};
	}

	// Read from global config
	const configFile = join(homedir(), ".indusk", "config.env");
	if (existsSync(configFile)) {
		const content = readFileSync(configFile, "utf-8");
		const hostMatch = content.match(/^INDUSK_INFRA_HOST=(.+)$/m);
		if (hostMatch) {
			const host = hostMatch[1].trim();
			return {
				falkordb: { host, port: 6379 },
				graphiti: { url: `http://${host}:8100/mcp/` },
			};
		}
	}

	// Default: local container
	return {
		falkordb: { host: "localhost", port: 6379 },
		graphiti: { url: "http://localhost:8100/mcp/" },
	};
}
