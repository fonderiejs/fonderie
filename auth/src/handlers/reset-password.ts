import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { hashPassword }          from '../services/password';

export function resetPasswordHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body     = ctx.meta['body'] as Record<string, unknown> | undefined
		const token    = body?.['token'];
		const password = body?.['password'];

		if (typeof token !== 'string' || typeof password !== 'string') {
			return Response.json({ error: 'token and password are required' }, { status: 422 });
		}

		if (password.length < 8) {
			return Response.json({ error: 'password must be at least 8 characters' }, { status: 422 });
		}

		const [row] = await store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_password_resets WHERE token = $1`,
			[token],
		);

		if (!row || new Date() > new Date(row.expires_at)) {
			return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
		}

		const passwordHash = await hashPassword(password);

		await store.transaction(async tx => {
			await Promise.all([
				tx.query(
					`UPDATE fonderie_users SET password_hash = $1 WHERE id = $2`,
					[passwordHash, row.user_id],
				),
				tx.query(
					`DELETE FROM fonderie_password_resets WHERE token = $1`,
					[token],
				),
			]);
		});

		return Response.json({ ok: true }, { status: 200 });
	}
}
