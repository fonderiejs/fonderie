import { setErrorResponse }               from '@fonderie-js/core';
import type { IFonderieContext, Middleware } from '@fonderie-js/core';

const handler: Middleware = async (ctx: IFonderieContext, next) => {
	if (!ctx.user) {
		return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
	}

	if (!ctx.user.emailVerifiedAt) {
		return setErrorResponse(403, 'EMAIL_NOT_VERIFIED', 'Email address has not been verified');
	}

	return next();
}

export function requireVerifiedEmail(): Middleware
export function requireVerifiedEmail(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requireVerifiedEmail(ctx?: IFonderieContext, next?: () => Promise<Response>): Middleware | Promise<Response> {
	if (ctx !== undefined && next !== undefined) {
		return handler(ctx, next)
	}
	return handler
}
