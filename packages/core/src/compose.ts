import type { IFonderieContext, Middleware } from './types';

// Classic onion middleware compose — same pattern as Koa's
export function compose(middlewares: Middleware[]) {
	return function (ctx: IFonderieContext, fallback: () => Promise<Response>): Promise<Response> {
		let index = -1

		function dispatch(i: number): Promise<Response> {
			if (i <= index) {
				throw new Error('next() called multiple times')
			}
			index = i
			const fn = middlewares[i] ?? fallback
			return fn(ctx, () => dispatch(i + 1))
		}

		return dispatch(0)
	}
}
