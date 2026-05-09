import { setErrorResponse } from '../response';

export function defaultErrorHandler(err: unknown): Response {
	const dev = process.env['NODE_ENV'] !== 'production'

	if (err instanceof Error) {
		console.error('[fonderie]', err.message, err.stack)
		return setErrorResponse(
			'SERVER_ERROR',
			dev ? err.message : 'Internal server error',
			500,
		)
	}

	console.error('[fonderie] unknown error', err)
	return setErrorResponse('SERVER_ERROR', 'Internal server error', 500)
}
