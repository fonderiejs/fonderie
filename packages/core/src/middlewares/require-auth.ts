import { setApiResponse, HTTP } from '../response';
import type { IFonderieContext, Middleware } from '../types';

const handler: Middleware = async (ctx: IFonderieContext, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}
	return next();
}

export function requireAuth(): Middleware
export function requireAuth(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requireAuth(ctx?: IFonderieContext, next?: () => Promise<Response>): Middleware | Promise<Response> {
	if (ctx !== undefined && next !== undefined) return handler(ctx, next)
	return handler
}
