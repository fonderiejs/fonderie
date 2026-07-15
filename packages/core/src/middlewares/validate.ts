import { setApiResponse, HTTP } from '../response';
import type { Middleware } from '../types';

// Route-boundary request validation — the one validation middleware every
// package wires in front of its body-taking routes, so error shape and parse
// semantics are identical across the whole surface.
//
// core stays dependency-free: this accepts anything implementing zod's
// safeParse contract structurally (zod v3/v4 both match), without importing
// zod. Feature packages own their schemas; see @fonderie/auth's schemas.ts
// for the reference pattern.

export interface IRequestSchema {
	safeParse(input: unknown):
		| { success: true; data: unknown }
		| { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
}

export function validate(schema: IRequestSchema): Middleware {
	return async (ctx, next) => {
		const result = schema.safeParse(ctx.meta['body'] ?? {});
		if (!result.success) {
			const first = result.error.issues[0];
			const path = first?.path.length ? `${first.path.map(String).join('.')}: ` : '';
			return setApiResponse(
				HTTP.UNPROCESSABLE,
				'INVALID_PARAMETER',
				`${path}${first?.message ?? 'Invalid request body'}`,
			);
		}
		// Parsed output replaces the raw body: trimmed, coerced, unknown keys
		// stripped — controllers read clean input.
		ctx.meta['body'] = result.data;
		return next();
	};
}
