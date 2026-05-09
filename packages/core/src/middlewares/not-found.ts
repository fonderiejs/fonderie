import { setApiResponse, HTTP } from '../response'
import type { Middleware }   from '../types'

export function notFoundMiddleware(): Middleware {
	return async (_ctx, _next) => setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Not found')
}
