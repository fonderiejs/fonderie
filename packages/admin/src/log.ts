import type { IFonderieContext, Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAdminLogEntry, IAdminLogPage } from './types';

export const DEFAULT_ACTOR = 'admin-token';

// Sits BEFORE the token guard, so a refused request is a row too. A failed
// write must not fail the request it describes.
export function adminLog(store: IStoreAdapter, route: string, module: string): Middleware {
	return async (ctx: IFonderieContext, next) => {
		const started = Date.now();
		const res = await next();
		const row = {
			// A scoped token names itself; X-Actor refines it; the root token is 'admin-token'.
			actor:
				ctx.request.headers.get('x-actor') ||
				(typeof ctx.meta['adminTokenName'] === 'string'
					? `token:${ctx.meta['adminTokenName']}`
					: DEFAULT_ACTOR),
			method: ctx.request.method,
			path: new URL(ctx.request.url).pathname,
			route,
			module,
			status: res.status,
			durationMs: Date.now() - started,
			requestId: typeof ctx.meta['requestId'] === 'string' ? ctx.meta['requestId'] : null,
			clientIp: ctx.meta.clientIp ?? null,
		};
		try {
			await store.query(
				`INSERT INTO fonderie_admin_log
				   (actor, method, path, route, module, status, duration_ms, request_id, client_ip)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					row.actor,
					row.method,
					row.path,
					row.route,
					row.module,
					row.status,
					row.durationMs,
					row.requestId,
					row.clientIp,
				],
			);
		} catch (err) {
			console.error(
				'[admin] could not write the admin log:',
				err instanceof Error ? err.message : err,
			);
		}
		return res;
	};
}

export const MAX_PAGE = 200;

// Newest first, keyset on (at, id). `before` is the last entry's cursor.
export async function readAdminLog(
	store: IStoreAdapter,
	opts: { limit?: number; before?: string } = {},
): Promise<IAdminLogPage> {
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), MAX_PAGE);
	const cursor = opts.before ? decodeCursor(opts.before) : null;
	const rows = await store.query<IAdminLogEntry>(
		`SELECT id, at, actor, method, path, route, module, status,
		        duration_ms AS "durationMs", request_id AS "requestId", client_ip AS "clientIp"
		   FROM fonderie_admin_log
		  WHERE ($1::timestamptz IS NULL OR (at, id) < ($1::timestamptz, $2::uuid))
		  ORDER BY at DESC, id DESC
		  LIMIT $3`,
		[cursor?.at ?? null, cursor?.id ?? null, limit + 1],
	);
	const page = rows.slice(0, limit);
	const last = page[page.length - 1];
	return {
		entries: page,
		next: rows.length > limit && last ? encodeCursor(last) : null,
	};
}

function encodeCursor(e: IAdminLogEntry): string {
	return Buffer.from(`${new Date(e.at).toISOString()}|${e.id}`, 'utf8').toString('base64url');
}

function decodeCursor(c: string): { at: string; id: string } | null {
	const [at, id] = Buffer.from(c, 'base64url').toString('utf8').split('|');
	return at && id ? { at, id } : null;
}
