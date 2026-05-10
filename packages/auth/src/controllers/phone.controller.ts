import { randomInt }                                      from 'node:crypto';

import { setApiResponse, HTTP }                           from '@fonderie-js/core';
import type { IFonderieContext, ICourierMessage }         from '@fonderie-js/core';
import type { IStoreAdapter }                             from '@fonderie-js/store';
import type { IAuthConfig }                               from '../config';
import { issueTokenPair, refreshTokenExpiry }             from '../services/jwt';
import { toUserDTO }                                      from '../dtos/user';
import { UserModel }                                      from '../models/user.model';
import { SessionModel }                                   from '../models/session.model';
import { PhoneVerificationModel }                         from '../models/phone-verification.model';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isValidPhone(phone: unknown): phone is string {
	return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(phone.trim());
}

export function phoneController(store: IStoreAdapter, config: IAuthConfig) {
	const users      = new UserModel(store);
	const sessions   = new SessionModel(store);
	const phoneVerif = new PhoneVerificationModel(store);

	return {
		sendOtp: async (ctx: IFonderieContext): Promise<Response> => {
			const body  = ctx.meta['body'] as Record<string, unknown> | undefined;
			const phone = body?.['phone'];

			if (!isValidPhone(phone)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'A valid phone number is required');
			}

			const otp       = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + OTP_TTL_MS);

			await phoneVerif.upsert(phone.trim(), otp, expiresAt);

			ctx.meta['message'] = {
				type:      'phone-otp',
				data:      { otp },
				recipient: { email: null, phone: phone.trim(), deviceToken: null },
			} satisfies ICourierMessage;

			return setApiResponse(HTTP.OK, 'OTP_SENT', 'A verification code has been sent to your phone.');
		},

		verify: async (ctx: IFonderieContext): Promise<Response> => {
			const body  = ctx.meta['body'] as Record<string, unknown> | undefined;
			const phone = body?.['phone'];
			const otp   = body?.['otp'];

			if (!isValidPhone(phone)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'A valid phone number is required');
			}
			if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'otp must be a 6-digit code');
			}

			const record = await phoneVerif.find(phone.trim());
			if (!record) {
				return setApiResponse(HTTP.BAD_REQUEST, 'PHONE_VERIFICATION_FAILED', 'No pending verification for this number');
			}
			if (new Date() > record.expiresAt) {
				await phoneVerif.delete(phone.trim());
				return setApiResponse(HTTP.BAD_REQUEST, 'PHONE_VERIFICATION_FAILED', 'Verification code expired');
			}
			if (record.otp !== otp) {
				return setApiResponse(HTTP.BAD_REQUEST, 'PHONE_VERIFICATION_FAILED', 'Invalid verification code');
			}

			await phoneVerif.delete(phone.trim());
			const { id } = await users.upsertByPhone(phone.trim(), record.firstName, record.lastName);

			const user = await users.findById(id);
			if (!user) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Authentication failed');
			}

			if (user.suspended) {
				return setApiResponse(HTTP.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'Account suspended. Please contact support.');
			}

			const { accessToken, refreshToken } = issueTokenPair(user.id, config);
			await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

			return Response.json(
				{
					reason:      'PHONE_VERIFIED',
					explanation: 'Phone verified successfully.',
					result: {
						tokens: { access: accessToken, refresh: refreshToken },
						user:   toUserDTO(user),
					},
				},
				{
					status: 200,
					headers: {
						'Set-Cookie': [
							`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
							`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh`,
						].join(', '),
					},
				},
			);
		},
	};
}
