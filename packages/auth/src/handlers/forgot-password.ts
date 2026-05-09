import { randomBytes }                       from 'node:crypto';

import { setApiResponse, setErrorResponse }  from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';
import type { ICourierMessage }             from '@fonderie-js/core';

import { findUserByEmail }       from '../services/session';

export function forgotPasswordHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body  = ctx.meta['body'] as Record<string, unknown> | undefined
		const email = body?.['email'];

		if (typeof email !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'email is required', 422);
		}

		// Always return 200 — don't leak whether email exists
		const user = await findUserByEmail(email, store);
		if (!user) {
			return setApiResponse('PASSWORD_RESET_EMAIL_SENT', 'Password reset email sent (if account exists).');
		}

		const token     = randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60);  // 1 hour

		await store.query(
			`INSERT INTO fonderie_password_resets (user_id, token, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id) DO UPDATE
			SET token = $2, expires_at = $3`,
			[user.id, token, expiresAt],
		);

		// Email sending is handled by @fonderie-js/courier — emit via ctx.meta
		ctx.meta['message'] = {
			type:      'password-reset',
			recipient: { email, phone: null, deviceToken: null },
			data:      { token },
		} satisfies ICourierMessage

		return setApiResponse('PASSWORD_RESET_EMAIL_SENT', 'Password reset email sent (if account exists).');
	}
}
