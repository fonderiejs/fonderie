import { randomUUID } from 'node:crypto';
import type { Middleware } from '@fonderie/core';
import type { Logger } from '../logger';

// Accept a caller/gateway-supplied X-Request-ID only when it's a bounded, safe
// token — a raw header could otherwise inject newlines into the logs or bloat
// them. Covers a uuid and the client's own fallback ids alike.
function safeInboundId(value: string | null): string | null {
	return value && value.length <= 200 && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
}

export function requestLogger(logger: Logger): Middleware {
	return async (ctx, next) => {
		if (ctx.meta['_buildContext']) {
			return await next();
		}

		// One id threads the whole request: honour an inbound X-Request-ID (client
		// or load balancer) so traces join up end-to-end, else mint one.
		const requestId = safeInboundId(ctx.request.headers.get('x-request-id')) ?? randomUUID();
		const start = Date.now();
		const method = ctx.request.method;
		const pathname = new URL(ctx.request.url).pathname;

		ctx.meta['requestId'] = requestId;
		ctx.meta['logger'] = logger.child({ requestId });

		logger.info(`→ ${method} ${pathname}`, { requestId });

		const response = await next();

		const duration = Date.now() - start;
		const status = response.status;
		const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

		logger[level](`← ${status} ${method} ${pathname}`, {
			requestId,
			status,
			duration,
			...(ctx.user ? { userId: ctx.user.id } : {}),
			...(ctx.workspace ? { workspaceId: ctx.workspace.id } : {}),
		});

		// Echo the id so the caller (and support) can quote it and correlate to
		// these logs. Locally-built responses have mutable headers.
		response.headers.set('X-Request-Id', requestId);
		return response;
	};
}
