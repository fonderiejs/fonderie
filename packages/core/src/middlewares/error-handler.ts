import { setApiResponse, HTTP } from '../response';

export function defaultErrorHandler(err: unknown): Response {
	const dev = process.env['NODE_ENV'] !== 'production'

	if (err instanceof Error) {
		console.error('[fonderie]', err.message, err.stack)
		return setApiResponse(
			HTTP.SERVER_ERROR,
			'SERVER_ERROR',
			dev ? err.message : 'Internal server error',
		)
	}

	console.error('[fonderie] unknown error', err)
	return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Internal server error')
}
