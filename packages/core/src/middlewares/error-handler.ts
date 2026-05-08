export function defaultErrorHandler(err: unknown): Response {
	const dev = process.env['NODE_ENV'] !== 'production'

	if (err instanceof Error) {
		console.error('[fonderie]', err.message, err.stack)
		return Response.json(
			{
				error: 'Internal server error',
				...(dev && { message: err.message, stack: err.stack }),
			},
			{ status: 500 },
		)
	}

	console.error('[fonderie] unknown error', err)
	return Response.json({ error: 'Internal server error' }, { status: 500 })
}
