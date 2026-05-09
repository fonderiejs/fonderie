import { randomInt }             from 'node:crypto';

import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';
import type { ICourierMessage }             from '@fonderie-js/core';

export function resendVerificationHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		if (ctx.user.emailVerifiedAt) {
			return setErrorResponse(
				'EMAIL_ALREADY_VERIFIED',
				'Your email address has already been verified. No further action is needed.',
				400,
			);
		}

		const pin       = randomInt(100000, 1000000).toString()
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

		await store.transaction(async tx => {
			await tx.query(
				`DELETE FROM fonderie_email_verifications WHERE user_id = $1`,
				[ctx.user!.id],
			);
			await tx.query(
				`INSERT INTO fonderie_email_verifications (token, user_id, expires_at)
				VALUES ($1, $2, $3)`,
				[pin, ctx.user!.id, expiresAt],
			);
		});

		ctx.meta['message'] = {
			type:      'email-verification',
			recipient: { email: ctx.user.email, phone: null, deviceToken: null },
			data:      { pin, firstName: ctx.user.firstName ?? '' },
		} satisfies ICourierMessage

		return setApiResponse('VERIFICATION_EMAIL_SENT', 'Verification email sent', {
			stat:    'success',
			message: 'Verification email sent',
			data: {
				token:     pin,
				expiresAt: expiresAt.toISOString(),
				email:     ctx.user.email,
			},
		});
	}
}
