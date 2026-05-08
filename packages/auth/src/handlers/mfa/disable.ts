import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { verifyTotpToken } from '../../services/mfa';
import { findUserById }    from '../../services/session';

export function mfaDisableHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const body = ctx.meta['body'] as Record<string, unknown> | undefined;
		const code = body?.['code'];

		if (typeof code !== 'string') {
			return setErrorResponse('MISSING_CODE', 'TOTP code is required', 422);
		}

		const user = await findUserById(ctx.user.id, store);
		if (!user || !user.mfaEnabled) {
			return setErrorResponse('MFA_NOT_ENABLED', 'MFA is not enabled', 400);
		}

		const secret = (user as unknown as { mfaSecret: string | null }).mfaSecret;
		if (!secret || !verifyTotpToken(code, secret)) {
			return setErrorResponse('INVALID_CODE', 'Invalid TOTP code', 401);
		}

		await store.query(
			`UPDATE fonderie_users SET mfa_enabled = false, mfa_secret = NULL, updated_at = now() WHERE id = $1`,
			[ctx.user.id],
		);

		return setApiResponse({ ok: true });
	}
}
