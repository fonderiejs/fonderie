import type { Middleware } from '../types';

export const withLogger: Middleware = async (ctx, next) => {
	const start = Date.now();

	const { method, url } = ctx.request;
	const { pathname } = new URL(url);

	const response = await next();

	console.log(
		JSON.stringify({
			ts: new Date().toISOString(),
			method,
			path: pathname,
			status: response.status,
			ms: Date.now() - start,
		}),
	);

	return response;
};
