import { setApiResponse, HTTP } from '../response';
import type { Middleware } from '../types';

export const requireAuth: Middleware = async (ctx, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}
	return next();
};
