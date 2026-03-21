import { flowDb, parser$1 } from "./chunk-6I4JUKEA.js";
import { flowRendererV2, flowStyles } from "./chunk-A5WWOCVK.js";
import "./chunk-VW2L7BRW.js";
import "./chunk-NE7LKVZC.js";
import "./chunk-SOBCWSDB.js";
import "./chunk-HTVY2ZTW.js";
import "./chunk-KAQAGEVX.js";
import { require_dayjs_min, require_dist, setConfig } from "./chunk-MVEA22LD.js";
import { __toESM } from "./chunk-PR4QN5HX.js";

// ../../node_modules/.pnpm/mermaid@10.9.5/node_modules/mermaid/dist/flowDiagram-v2-4f6560a1.js
var import_dayjs = __toESM(require_dayjs_min(), 1);
var import_sanitize_url = __toESM(require_dist(), 1);
var diagram = {
	parser: parser$1,
	db: flowDb,
	renderer: flowRendererV2,
	styles: flowStyles,
	init: (cnf) => {
		if (!cnf.flowchart) {
			cnf.flowchart = {};
		}
		cnf.flowchart.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
		setConfig({ flowchart: { arrowMarkerAbsolute: cnf.arrowMarkerAbsolute } });
		flowRendererV2.setConf(cnf.flowchart);
		flowDb.clear();
		flowDb.setGen("gen-2");
	},
};

export { diagram };
//# sourceMappingURL=flowDiagram-v2-4f6560a1-BJNZJGDY.js.map
