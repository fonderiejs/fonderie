import { constantTimeEqual } from '../crypto';
import { setApiResponse, HTTP } from '../response';
import { MIN_SECRET_LENGTH, secretStrengthProblem } from '../secret-strength';
import type { IReadinessProblem, Middleware } from '../types';

// The one admin-route guard for every Fonderie module with an ops surface
// (billing plan-writes/wallet-grant, config/secrets admin, courier template
// admin). A bootstrap Bearer token compared in constant time. Modules MUST
// register their admin routes only when a token is configured (unset ⇒ 404),
// so this guard only ever runs against a real token. See docs/ADMIN-AUTH-SPEC.md.
export function requireAdminToken(adminToken: string): Middleware {
	return (ctx, next) => {
		const header = ctx.request.headers.get('authorization') ?? '';
		const token = header.startsWith('Bearer ') ? header.slice(7) : '';
		// Same 401 for a missing and a wrong token — no oracle distinguishing them.
		if (!token || !constantTimeEqual(token, adminToken)) {
			return Promise.resolve(
				setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing or invalid admin token'),
			);
		}
		return next();
	};
}

// A bootstrap admin token must be strong: an admin surface guarded by a short or
// placeholder token is barely guarded at all. Modules call this from
// checkReadiness() so the rule (shared secret-strength denylist) is enforced
// identically everywhere. Returns a problem for a weak/placeholder token;
// nothing when unset (that surface is simply not exposed).
export function validateAdminToken(
	token: string | undefined,
	opts: { module: string },
): IReadinessProblem[] {
	if (!token) return [];
	const problem = secretStrengthProblem(token);
	if (problem === 'too-short') {
		return [
			{
				module: opts.module,
				severity: 'error',
				message: `adminToken must be at least ${MIN_SECRET_LENGTH} characters (got ${token.length})`,
			},
		];
	}
	if (problem === 'placeholder') {
		return [
			{ module: opts.module, severity: 'error', message: 'adminToken looks like a placeholder or dev-default value' },
		];
	}
	return [];
}
