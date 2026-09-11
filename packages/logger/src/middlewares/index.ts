import { randomUUID } from 'node:crypto';
import type { Middleware } from '@fonderie/core';
import type { Logger } from '../logger';
import {
	formatTraceparent,
	msToUnixNano,
	newSpanId,
	newTraceContext,
	parseTraceparent,
	type ITraceContext,
	type ITraceExporter,
} from '../trace';

// Accept a caller/gateway-supplied X-Request-ID only when it's a bounded, safe
// token — a raw header could otherwise inject newlines into the logs or bloat
// them. Covers a uuid and the client's own fallback ids alike.
function safeInboundId(value: string | null): string | null {
	return value && value.length <= 200 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
}

export function requestLogger(logger: Logger, exporter?: ITraceExporter): Middleware {
	return async (ctx, next) => {
		if (ctx.meta['_buildContext']) {
			return await next();
		}

		// Phase 1 — the quotable correlation id: honour an inbound X-Request-ID,
		// else mint one. (Kept independent of the trace id for back-compat: an
		// older client that sends only X-Request-ID still correlates.)
		const requestId = safeInboundId(ctx.request.headers.get('x-request-id')) ?? randomUUID();

		// W3C trace context: continue an inbound trace (the upstream span becomes
		// our parent) or start a fresh one. A trace-aware client sends both, wired
		// so its X-Request-ID equals this trace id.
		const inbound = parseTraceparent(ctx.request.headers.get('traceparent'));
		const trace: ITraceContext = inbound
			? { traceId: inbound.traceId, spanId: newSpanId(), parentSpanId: inbound.spanId, sampled: inbound.sampled }
			: newTraceContext();

		const startMs = Date.now();
		const method = ctx.request.method;
		const pathname = new URL(ctx.request.url).pathname;

		ctx.meta['requestId'] = requestId;
		ctx.meta['traceId'] = trace.traceId;
		ctx.meta['spanId'] = trace.spanId;
		ctx.meta['logger'] = logger.child({ requestId, traceId: trace.traceId });

		logger.info(`→ ${method} ${pathname}`, { requestId, traceId: trace.traceId });

		const response = await next();

		const duration = Date.now() - startMs;
		const status = response.status;
		const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

		logger[level](`← ${status} ${method} ${pathname}`, {
			requestId,
			traceId: trace.traceId,
			spanId: trace.spanId,
			status,
			duration,
			...(ctx.user ? { userId: ctx.user.id } : {}),
			...(ctx.workspace ? { workspaceId: ctx.workspace.id } : {}),
		});

		// Echo the correlation id (quotable) and the server span's traceparent
		// (so a downstream continues the trace). Locally-built responses have
		// mutable headers.
		response.headers.set('X-Request-Id', requestId);
		response.headers.set('traceparent', formatTraceparent(trace));

		// Emit the request span if an exporter is wired and the trace is sampled.
		// Fire-and-forget: telemetry never delays or breaks the response.
		if (exporter && trace.sampled) {
			void exporter.export({
				name: `${method} ${pathname}`,
				traceId: trace.traceId,
				spanId: trace.spanId,
				...(trace.parentSpanId ? { parentSpanId: trace.parentSpanId } : {}),
				startUnixNano: msToUnixNano(startMs),
				endUnixNano: msToUnixNano(startMs + duration),
				status,
				attributes: {
					'http.request.method': method,
					'url.path': pathname,
					'http.response.status_code': status,
					'fonderie.request_id': requestId,
					...(ctx.user ? { 'enduser.id': ctx.user.id } : {}),
					...(ctx.workspace ? { 'fonderie.workspace_id': ctx.workspace.id } : {}),
				},
			});
		}

		return response;
	};
}
