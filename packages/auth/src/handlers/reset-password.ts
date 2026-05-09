import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import { hashPassword }                     from '../services/password';

export function resetPasswordHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body     = ctx.meta['body'] as Record<string, unknown> | undefined
		const token    = body?.['resetToken'] ?? body?.['token'];
		const password = body?.['password'];

		if (typeof token !== 'string' || typeof password !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'resetToken and password are required', 422);
		}

		if (password.length < 8) {
			return setErrorResponse('INVALID_PARAMETER', 'password must be at least 8 characters', 422);
		}

		const [row] = await store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_password_resets WHERE token = $1`,
			[token],
		);

		if (!row || new Date() > new Date(row.expires_at)) {
			return setErrorResponse('PASSWORD_RESET_FAILED', 'Invalid or expired token', 400);
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

		return setApiResponse('PASSWORD_RESET_SUCCESSFUL', 'Password reset successfully.');
	}
}
