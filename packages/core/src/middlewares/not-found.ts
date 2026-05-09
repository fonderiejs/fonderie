import { setErrorResponse } from '../response'
import type { Middleware }   from '../types'

export function notFoundMiddleware(): Middleware {
	return async (_ctx, _next) => setErrorResponse(404, 'NOT_FOUND', 'Not found')
}
