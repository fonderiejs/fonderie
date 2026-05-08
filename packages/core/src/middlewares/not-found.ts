import type { Middleware } from '../types'

export function notFoundMiddleware(): Middleware {
	return async (_ctx, _next) => Response.json({
		error: 'Not found', status: 404
	}, { status: 404 })
}
