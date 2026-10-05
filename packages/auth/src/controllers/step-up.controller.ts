import { randomInt } from 'node:crypto';

import { HTTP, background, setApiResponse } from '@fonderie/core';
import type { ICourierMessage, IFonderieContext } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import { MESSAGE_KEYS, type IAuthConfig } from '../config';
import { AccountDeletionModel } from '../models/account-deletion.model';
import { UserModel } from '../models/user.model';
import { checkCooldown } from '../services/cooldown';
import { verifyPassword } from '../services/password';
import { verifySecondFactor } from '../services/second-factor';
import { issueStepUpToken, stepUpMethods, type StepUpMethod } from '../services/step-up';

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_COOLDOWN_MS = 60 * 1000;

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): prove it's still you, get a
// five-minute token for the big move. See services/step-up.ts.
export function stepUpController(store: IStoreAdapter, config: IAuthConfig, bus?: EventBus) {
	const users = new UserModel(store);
	const codes = new AccountDeletionModel(store, 'fonderie_step_up_codes');
	const failed = () => setApiResponse(HTTP.UNAUTHORIZED, 'STEP_UP_FAILED', "That didn't confirm it's you. Try again.");

	const load = async (ctx: IFonderieContext) => {
		const user = await users.findById(ctx.user!.id);
		if (!user) return null;
		return { user, methods: stepUpMethods({ ...user, hasPassword: !!user.passwordHash }) };
	};

	return {
		/** Which proofs this account can give. */
		methods: async (ctx: IFonderieContext): Promise<Response> => {
			const found = await load(ctx);
			if (!found) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			return setApiResponse(HTTP.OK, 'STEP_UP_METHODS', 'How you can confirm it’s you.', { methods: found.methods });
		},

		/** A code to the account's email or phone — for an account without a password. */
		sendCode: async (ctx: IFonderieContext): Promise<Response> => {
			const found = await load(ctx);
			if (!found) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			const { channel } = ctx.meta['body'] as { channel: 'email' | 'sms' };
			if (!found.methods.includes(channel)) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'STEP_UP_METHOD_UNAVAILABLE',
					found.methods.includes('mfa')
						? 'Confirm with your authenticator app.'
						: `There is no ${channel === 'email' ? 'email address' : 'phone number'} on this account.`,
					{ methods: found.methods },
				);
			}
			const remainingMs = checkCooldown(await codes.lastSentAt(found.user.id), CODE_COOLDOWN_MS);
			if (remainingMs > 0) {
				const retryAfter = Math.ceil(remainingMs / 1000);
				return setApiResponse(HTTP.TOO_MANY_REQUESTS, 'VERIFICATION_COOLDOWN', `Wait ${retryAfter}s before requesting a new code.`, { retryAfter });
			}
			const code = randomInt(100000, 1000000).toString();
			await codes.saveCode(found.user.id, code, channel, new Date(Date.now() + CODE_TTL_MS));
			const address = channel === 'email' ? found.user.email! : found.user.phone!;
			await background(
				bus?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.stepUpCode,
					locale: found.user.locale,
					data: { code },
					recipient: channel === 'email'
						? { email: address, phone: null, deviceToken: null }
						: { email: null, phone: address, deviceToken: null },
				} satisfies ICourierMessage),
			);
			return setApiResponse(HTTP.ACCEPTED, 'STEP_UP_CODE_SENT', 'A code was sent.', { channel, expiresInSeconds: CODE_TTL_MS / 1000 });
		},

		/**
		 * Prove it: the authenticator when two-factor is on (nothing else is
		 * accepted then), otherwise the password or a code that was sent.
		 */
		confirm: async (ctx: IFonderieContext): Promise<Response> => {
			const found = await load(ctx);
			if (!found) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			const { user, methods } = found;
			const body = ctx.meta['body'] as { password?: string; mfaCode?: string; code?: string };
			let method: StepUpMethod | null = null;
			if (methods.includes('mfa')) {
				if (await verifySecondFactor(store, config, user.id, body.mfaCode)) method = 'mfa';
			} else if (body.password !== undefined) {
				if (user.passwordHash && (await verifyPassword(body.password, user.passwordHash))) method = 'password';
			} else if (body.code !== undefined) {
				const checked = await codes.checkCode(user.id, body.code);
				if (checked.result === 'ok') method = checked.channel ?? 'email';
			}
			if (!method) return failed();
			const { token, expiresAt } = issueStepUpToken(user.id, method, config);
			return setApiResponse(HTTP.OK, 'STEP_UP_CONFIRMED', 'Confirmed.', { stepUpToken: token, expiresAt, method });
		},
	};
}
