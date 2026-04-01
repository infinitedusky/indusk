import { createServer } from "node:http";
import { logger } from "./logger.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("otel-test-v2");
const PORT = 3457;

const server = createServer((req, res) => {
	const span = tracer.startSpan("request.handle", {
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
	} else if (req.url === "/inference") {
		const inferSpan = tracer.startSpan("inference.gemini.generate", {
			attributes: {
				"otel.category": "inference",
				"inference.model": "gemini-2.5-flash",
				"inference.prompt_tokens": 150,
			},
		});
		// Simulate inference delay
		setTimeout(() => {
			inferSpan.setAttribute("inference.completion_tokens", 42);
			inferSpan.end();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ result: "inference complete" }));
		}, 100);
	} else {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", service: "otel-test-v2" }));
	}

	if (req.url !== "/inference") span.end();
});

server.listen(PORT, () => {
	logger.info({ port: PORT }, "otel-test-v2 server started");
});
