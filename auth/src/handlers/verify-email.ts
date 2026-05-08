import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

export function verifyEmailHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body  = ctx.meta['body'] as Record<string, unknown> | undefined
		const token = body?.['token'];

		if (typeof token !== 'string') {
			return Response.json({ error: 'token is required' }, { status: 422 });
		}

		const row = await store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_email_verifications
			WHERE token = $1`,
			[token],
		);

		if (!row) {
			return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
		}

		if (new Date() > new Date(row.expires_at)) {
			return Response.json({ error: 'Token expired' }, { status: 400 });
		}

		await store.transaction(async tx => {
			await Promise.all([
				tx.query(
					`UPDATE fonderie_users SET email_verified_at = now() WHERE id = $1`,
					[row.user_id],
				),
				tx.query(
					`DELETE FROM fonderie_email_verifications WHERE token = $1`,
					[token],
				),
			]);
		});

		return Response.json({ ok: true }, { status: 200 });
	}
}
