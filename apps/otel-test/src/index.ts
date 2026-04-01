import { createServer } from "node:http";
import { logger } from "./logger.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("otel-test");
const PORT = 3456;

const server = createServer((req, res) => {
	const span = tracer.startSpan("http.request.handle", {
		attributes: {
			"otel.category": "business",
			"http.method": req.method,
			"http.path": req.url,
		},
	});

	logger.info({ method: req.method, path: req.url }, "request received");

	if (req.url === "/error") {
		const err = new Error("intentional test error");
		span.recordException(err);
		span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
		logger.error({ err }, "test error triggered");
		res.writeHead(500);
		res.end("error");
	} else {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", service: "otel-test" }));
	}

	span.end();
});

server.listen(PORT, () => {
	logger.info({ port: PORT }, "otel-test server started");
});
