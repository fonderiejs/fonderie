import type { Middleware } from '../types';

export interface CorsOptions {
	methods?: string[];
	headers?: string[];
	origin?: string | ((requestOrigin: string) => boolean);
}

export function withCors(options: CorsOptions = {}): Middleware {
	const {
		origin = '*',
		headers = ['Content-Type', 'Authorization'],
		methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	} = options;

	return async (ctx, next) => {
		const requestOrigin = ctx.request.headers.get('origin') ?? '';

		const allowOrigin =
			typeof origin === 'function' ? (origin(requestOrigin) ? requestOrigin : '') : origin;

		const corsHeaders: Record<string, string> = {
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Methods': methods.join(', '),
			'Access-Control-Allow-Headers': headers.join(', '),
		};
		// Omit the header entirely for a denied origin (an empty ACAO value is
		// invalid); when the value varies by request origin, say so — otherwise a
		// shared cache can serve one origin's ACAO to another.
		if (allowOrigin) corsHeaders['Access-Control-Allow-Origin'] = allowOrigin;
		if (typeof origin === 'function') corsHeaders['Vary'] = 'Origin';

		// Preflight — respond immediately, skip the pipeline
		if (ctx.request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const response = await next();

		const patched = new Headers(response.headers);

		for (const [k, v] of Object.entries(corsHeaders)) {
			patched.set(k, v);
		}

		return new Response(response.body, {
			headers: patched,
			status: response.status,
			statusText: response.statusText,
		});
	};
}
