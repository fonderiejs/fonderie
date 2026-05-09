import type { Middleware }    from '../types';
import { setErrorResponse }   from '../response';

export function bodyParserMiddleware(): Middleware {
	return async (ctx, next) => {
		const method = ctx.request.method.toUpperCase()

		// Nothing to parse on these
		if (method === 'GET' || method === 'HEAD') {
			return next()
		}

		const ct = ctx.request.headers.get('content-type') ?? ''

		try {
			if (ct.includes('application/json')) {
				ctx.meta.body = await ctx.request.clone().json()
			} else if (ct.includes('application/x-www-form-urlencoded')) {
				const text = await ctx.request.clone().text()
				ctx.meta.body = Object.fromEntries(new URLSearchParams(text))
			}
			// multipart/form-data left to the handler — no dep-free way to parse it
		} catch {
			return setErrorResponse(400, 'INVALID_REQUEST', 'Invalid request body')
		}

		return next()
	}
}
