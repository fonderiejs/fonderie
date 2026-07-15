import type { Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { z } from 'zod';

// Route-boundary request validation. Parses ctx.meta['body'] against a zod
// schema before the controller runs; on failure returns the same 422 envelope
// controllers already use (reason INVALID_PARAMETER), so the error contract
// is unchanged — just enforced consistently. On success the parsed (trimmed,
// coerced) body replaces the raw one, so controllers read clean input.

export function validate(schema: z.ZodType): Middleware {
	return async (ctx, next) => {
		const result = schema.safeParse(ctx.meta['body'] ?? {});
		if (!result.success) {
			const first = result.error.issues[0];
			const path = first?.path.length ? `${first.path.join('.')}: ` : '';
			return setApiResponse(
				HTTP.UNPROCESSABLE,
				'INVALID_PARAMETER',
				`${path}${first?.message ?? 'Invalid request body'}`,
			);
		}
		ctx.meta['body'] = result.data;
		return next();
	};
}
