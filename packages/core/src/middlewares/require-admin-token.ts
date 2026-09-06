import { timingSafeEqual } from 'node:crypto';

import { setApiResponse, HTTP } from '../response';
import type { IReadinessProblem, Middleware } from '../types';

// The one admin-route guard for every Fonderie module with an ops surface
// (billing plan-writes/wallet-grant, config/secrets admin, courier template
// admin). A bootstrap Bearer token compared in constant time. Modules MUST
// register their admin routes only when a token is configured (unset ⇒ 404),
// so this guard only ever runs against a real token. See docs/ADMIN-AUTH-SPEC.md.

// Constant-time comparison so a wrong token can't be recovered byte-by-byte from
// response timing. Length-guard first: timingSafeEqual throws on unequal lengths,
// and that early return is acceptable — the token's length is not the secret.
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
		// Same 401 for a missing and a wrong token — no oracle distinguishing them.
		if (!token || !safeTokenEqual(token, adminToken)) {
			return Promise.resolve(
				setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing or invalid admin token'),
			);
		}
		return next();
	};
}

// A bootstrap admin token must be strong: an admin surface guarded by a short or
// placeholder token is barely guarded at all. Modules call this from
// checkReadiness() so the rule is enforced identically everywhere (previously
// only @fonderie/config validated it). Returns a problem for a weak/placeholder
// token; nothing when unset (that surface is simply not exposed).
const MIN_ADMIN_TOKEN_LENGTH = 32;
const PLACEHOLDER_TOKEN =
	/dev-secret|test-secret|changeme|change-me|your[-_]secret|placeholder|example|insecure|admin-token|min-32-chars/i;

export function validateAdminToken(
	token: string | undefined,
	opts: { module: string },
): IReadinessProblem[] {
	if (!token) return [];
	if (token.length < MIN_ADMIN_TOKEN_LENGTH) {
		return [
			{
				module: opts.module,
				severity: 'error',
				message: `adminToken must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters (got ${token.length})`,
			},
		];
	}
	if (PLACEHOLDER_TOKEN.test(token)) {
		return [
			{ module: opts.module, severity: 'error', message: 'adminToken looks like a placeholder or dev-default value' },
		];
	}
	return [];
}
