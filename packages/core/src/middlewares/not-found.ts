import { setErrorResponse } from '../response'
import type { Middleware }   from '../types'

export function notFoundMiddleware(): Middleware {
	return async (_ctx, _next) => setErrorResponse('NOT_FOUND', 'Not found', 404)
}
