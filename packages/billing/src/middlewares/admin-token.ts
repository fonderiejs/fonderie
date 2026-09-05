import { timingSafeEqual } from 'node:crypto';

import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';

// Bootstrap-token guard for the wallet's manual-grant surface — the same
// mechanism as @fonderie/config's admin surface: a Bearer token compared in
// constant time, with the route only registered when a token is configured.

// Constant-time comparison so a wrong token can't be recovered byte-by-byte
// from response timing. Length-guard first: timingSafeEqual throws on unequal
// lengths, and that early return is acceptable — the secret's length is not
// the sensitive part.
function safeTokenEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

export function requireAdminToken(adminToken: string): Middleware {
	return (ctx, next) => {
		const header = ctx.request.headers.get('authorization') ?? '';
		const token = header.startsWith('Bearer ') ? header.slice(7) : '';
		if (!token || !safeTokenEqual(token, adminToken)) {
			return Promise.resolve(
				setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing or invalid admin token'),
			);
		}
		return next();
	};
}
