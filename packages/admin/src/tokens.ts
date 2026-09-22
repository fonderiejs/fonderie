import { createHash, randomBytes } from 'node:crypto';
import type { IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, constantTimeEqual, setApiResponse } from '@fonderie/core';
import type { IRequestSchema } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import type { AdminScope, IAdminTokenRecord } from './types';

export const SCOPES: readonly AdminScope[] = ['read', 'write', 'secrets'];

// Derived from the route, never annotated: the plaintext secret read is the
// one thing that needs `secrets`; any other mutation needs `write`.
export function scopeFor(method: string, path: string): AdminScope {
	if (/\/secrets(\/|$)/.test(path)) return 'secrets';
	return method.toUpperCase() === 'GET' ? 'read' : 'write';
}

// `write` implies `read`; `secrets` implies both.
export function grants(held: readonly AdminScope[], needed: AdminScope): boolean {
	if (held.includes('secrets')) return true;
	if (needed === 'secrets') return false;
	if (held.includes('write')) return true;
	return needed === 'read' && held.includes('read');
}

export const hashToken = (token: string): string =>
	createHash('sha256').update(token).digest('hex');
const mintToken = (): string => `fad_${randomBytes(24).toString('base64url')}`;

const COLUMNS = `id, name, scopes, created_by AS "createdBy", created_at AS "createdAt",
                 expires_at AS "expiresAt", revoked_at AS "revokedAt", last_used_at AS "lastUsedAt"`;

export async function listTokens(store: IStoreAdapter): Promise<IAdminTokenRecord[]> {
	return store.query<IAdminTokenRecord>(
		`SELECT ${COLUMNS} FROM fonderie_admin_tokens ORDER BY created_at DESC`,
	);
}

export async function issueToken(
	store: IStoreAdapter,
	input: { name: string; scopes: AdminScope[]; expiresInDays?: number; createdBy: string },
): Promise<{ token: string; record: IAdminTokenRecord }> {
	const token = mintToken();
	const expiresAt = input.expiresInDays
		? new Date(Date.now() + input.expiresInDays * 86_400_000)
		: null;
	const [record] = await store.query<IAdminTokenRecord>(
		`INSERT INTO fonderie_admin_tokens (name, token_hash, scopes, created_by, expires_at)
		 VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
		[input.name, hashToken(token), input.scopes, input.createdBy, expiresAt],
	);
	if (!record) throw new Error('[admin] token insert returned no row');
	return { token, record };
}

export async function revokeToken(store: IStoreAdapter, id: string): Promise<boolean> {
	const rows = await store.query<{ id: string }>(
		`UPDATE fonderie_admin_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
		[id],
	);
	return rows.length > 0;
}

async function findLive(store: IStoreAdapter, token: string): Promise<IAdminTokenRecord | null> {
	const [row] = await store.query<IAdminTokenRecord>(
		`SELECT ${COLUMNS} FROM fonderie_admin_tokens
		  WHERE token_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
		[hashToken(token)],
	);
	return row ?? null;
}

const bearer = (ctx: IFonderieContext): string => {
	const h = ctx.request.headers.get('authorization') ?? '';
	return h.startsWith('Bearer ') ? h.slice(7) : '';
};
const UNAUTHORIZED = () =>
	setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Missing or invalid admin token');

// The bootstrap token is the root: every scope, and the only credential that
// may issue or revoke tokens. Issued tokens carry their scopes; a valid token
// short of the route's scope is 403, an unknown, revoked or expired one is
// the same 401 as a missing one. The token's name becomes the log's actor.
export function requireAdminScope(
	bootstrap: string,
	store: IStoreAdapter | undefined,
	needed: AdminScope | 'root',
): Middleware {
	return async (ctx, next) => {
		const token = bearer(ctx);
		if (!token) return UNAUTHORIZED();
		if (constantTimeEqual(token, bootstrap)) return next();
		if (needed === 'root' || !store) return UNAUTHORIZED();
		const record = await findLive(store, token);
		if (!record) return UNAUTHORIZED();
		if (!grants(record.scopes, needed)) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', `This token lacks the '${needed}' scope`);
		}
		ctx.meta['adminTokenName'] = record.name;
		void store
			.query(`UPDATE fonderie_admin_tokens SET last_used_at = now() WHERE id = $1`, [record.id])
			.catch(() => undefined);
		return next();
	};
}

// { name: 1–100 chars, scopes: non-empty subset of SCOPES, expiresInDays?: 1–3650 }
export const issueTokenSchema: IRequestSchema = {
	safeParse(input: unknown) {
		const fail = (path: string, message: string) => ({
			success: false as const,
			error: { issues: [{ path: [path], message }] },
		});
		const b = (input ?? {}) as Record<string, unknown>;
		const name = typeof b['name'] === 'string' ? b['name'].trim() : '';
		if (!name || name.length > 100) return fail('name', 'name is required (1–100 chars)');
		const scopes = b['scopes'];
		if (
			!Array.isArray(scopes) ||
			scopes.length === 0 ||
			!scopes.every((s) => SCOPES.includes(s as AdminScope))
		)
			return fail('scopes', `scopes must be a non-empty list of ${SCOPES.join(', ')}`);
		const days = b['expiresInDays'];
		if (
			days !== undefined &&
			(!Number.isInteger(days) || (days as number) < 1 || (days as number) > 3650)
		)
			return fail('expiresInDays', 'expiresInDays must be an integer between 1 and 3650');
		return {
			success: true as const,
			data: {
				name,
				scopes: [...new Set(scopes as AdminScope[])],
				...(days !== undefined ? { expiresInDays: days as number } : {}),
			},
		};
	},
};
