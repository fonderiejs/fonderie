import type { IFonderieContext }          from '@fonderie-js/core';
import type { IStoreAdapter }             from '@fonderie-js/store';

import { generateTotpSecret, generateTotpUri } from '../../services/mfa';

export function mfaEnableHandler(store: IStoreAdapter, issuer: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const secret = generateTotpSecret();
		const uri    = generateTotpUri(ctx.user.email, secret, issuer);

		await store.query(
			`UPDATE fonderie_users SET mfa_secret = $1 WHERE id = $2`,
			[secret, ctx.user.id],
		);

		return Response.json({ secret, uri }, { status: 200 });
	}
}
