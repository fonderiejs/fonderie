import { setErrorResponse }         from '@fonderie-js/core';
import type { IFonderieContext, Middleware } from '@fonderie-js/core';

const handler: Middleware = async (ctx: IFonderieContext, next) => {
	if (!ctx.user) {
		return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
	}

	return next();
}

export function requireAuth(): Middleware
export function requireAuth(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requireAuth(ctx?: IFonderieContext, next?: () => Promise<Response>): Middleware | Promise<Response> {
	if (ctx !== undefined && next !== undefined) {
		return handler(ctx, next)
	}
	return handler
}
