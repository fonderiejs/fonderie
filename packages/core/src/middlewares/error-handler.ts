import { setApiResponse, HTTP } from '../response';

export function defaultErrorHandler(err: unknown): Response {
	// Only leak the raw error message in EXPLICITLY non-production-like envs.
	// `NODE_ENV !== 'production'` also covered 'staging' and any custom value,
	// where an error message can carry connection strings / PII. Unknown or
	// unset NODE_ENV is treated as production-safe (no leak).
	const env = process.env['NODE_ENV'];
	const dev = env === 'development' || env === 'test';

	if (err instanceof Error) {
		console.error('[fonderie]', err.message, err.stack);
		return setApiResponse(
			HTTP.SERVER_ERROR,
			'SERVER_ERROR',
			dev ? err.message : 'Internal server error',
		);
	}

	console.error('[fonderie] unknown error', err);
	return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Internal server error');
}
