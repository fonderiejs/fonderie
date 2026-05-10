import { randomInt, randomBytes }                       from 'node:crypto';

import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext, ICourierMessage }        from '@fonderie-js/core';
import type { IStoreAdapter }                           from '@fonderie-js/store';
import type { IAuthConfig }                             from '../config';
import { issueTokenPair, verifyToken, refreshTokenExpiry } from '../services/jwt';
import { hashPassword, verifyPassword }                 from '../services/password';
import { toUserDTO }                                    from '../dtos/user';
import { UserModel }                 from '../models/user.model';
import { SessionModel }              from '../models/session.model';
import { EmailVerificationModel }    from '../models/email-verification.model';
import { PasswordResetModel }        from '../models/password-reset.model';
import { PhoneVerificationModel }    from '../models/phone-verification.model';

function isValidPhone(phone: unknown): phone is string {
	return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(phone.trim());
}

function extractRefreshToken(ctx: IFonderieContext): string | null {
	const body = ctx.meta['body'] as Record<string, unknown> | undefined;
	if (typeof body?.['refreshToken'] === 'string') {
		return body['refreshToken'] as string;
	}

	const cookie = ctx.request.headers.get('cookie') ?? '';
	const match  = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);

	return match?.[1] ?? null;
}

export function authController(store: IStoreAdapter, config: IAuthConfig) {
	const users         = new UserModel(store);
	const sessions      = new SessionModel(store);
	const passwordReset = new PasswordResetModel(store);
	const emailVerif    = new EmailVerificationModel(store);
	const phoneVerif    = new PhoneVerificationModel(store);

	const OTP_TTL_MS = 10 * 60 * 1000;

	return {
		register: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const { email, password, phone, firstName = null, lastName = null } = body ?? {};

			// ── Email branch takes priority (cheaper than SMS) ───────
			if (typeof email === 'string' && typeof password === 'string') {
				if (password.length < 8) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'password must be at least 8 characters');
				}

				const existing = await users.findByEmail(email);
				if (existing) {
					return setApiResponse(HTTP.CONFLICT, 'USER_ALREADY_EXISTS', 'Email already registered');
				}

				const passwordHash = await hashPassword(password);
				const row = await users.create(
					email,
					passwordHash,
					firstName as string | null,
					lastName  as string | null,
				);

				if (!row) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const pin       = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
				await emailVerif.create(row.id, pin, expiresAt);

				ctx.meta['message'] = {
					type:      'email-verification',
					data:      { pin, firstName: firstName ?? '' },
					recipient: { email, phone: null, deviceToken: null },
				} satisfies ICourierMessage;

				const user = await users.findById(row.id);
				if (!user) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const { accessToken, refreshToken } = issueTokenPair(user.id, config);
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				return Response.json(
					{
						reason:      'USER_EMAIL_REGISTERED',
						explanation: 'Account created. Check your email for a verification code.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user:   toUserDTO(user),
						},
					},
					{
						status: 201,
						headers: {
							'Set-Cookie': [
								`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
								`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh`,
							].join(', '),
						},
					},
				);
			}

			// ── Phone branch ──────────────────────────────────────────
			if (isValidPhone(phone)) {
				const existing = await users.findByPhone(phone.trim());
				if (existing) {
					return setApiResponse(HTTP.CONFLICT, 'USER_ALREADY_EXISTS', 'Phone already registered');
				}

				const { id } = await users.findOrCreateByPhone(
					phone.trim(),
					(firstName as string | null) ?? null,
					(lastName  as string | null) ?? null,
				);

				const otp       = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				await phoneVerif.upsert(phone.trim(), otp, expiresAt);

				ctx.meta['message'] = {
					type:      'phone-otp',
					data:      { otp },
					recipient: { email: null, phone: phone.trim(), deviceToken: null },
				} satisfies ICourierMessage;

				const user = await users.findById(id);
				if (!user) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const { accessToken, refreshToken } = issueTokenPair(user.id, config);
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				return Response.json(
					{
						reason:      'USER_PHONE_REGISTERED',
						explanation: 'Account created. A verification code has been sent to your phone.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user:   toUserDTO(user),
						},
					},
					{
						status: 202,
						headers: {
							'Set-Cookie': [
								`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
								`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh`,
							].join(', '),
						},
					},
				);
			}

			return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Provide email + password or a valid phone number');
		},

		login: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;

			// ── Email branch takes priority (cheaper than SMS) ────────
			if (typeof body?.['email'] === 'string' && typeof body?.['password'] === 'string') {
				const { email, password } = body as { email: string; password: string };

				const user = await users.findByEmail(email);
				if (!user || !user.passwordHash) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				const valid = await verifyPassword(password, user.passwordHash);
				if (!valid) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				if (user.suspended) {
					return setApiResponse(HTTP.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'Account suspended. Please contact support.');
				}

				if (user.mfaEnabled) {
					return setApiResponse(HTTP.OK, 'MFA_REQUIRED', 'Multi-factor authentication required');
				}

				const { accessToken, refreshToken } = issueTokenPair(user.id, config);
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				return Response.json(
					{
						reason:      'USER_EMAIL_LOGIN',
						explanation: 'Login successful.',
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
			}

			// ── Phone branch ──────────────────────────────────────────
			const phone = body?.['phone'];
			if (isValidPhone(phone)) {
				const user = await users.findByPhone(phone.trim());
				if (!user) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}
				if (user.suspended) {
					return setApiResponse(HTTP.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'Account suspended. Please contact support.');
				}

				const otp       = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				await phoneVerif.upsert(phone.trim(), otp, expiresAt);

				ctx.meta['message'] = {
					type:      'phone-otp',
					data:      { otp },
					recipient: { email: null, phone: phone.trim(), deviceToken: null },
				} satisfies ICourierMessage;

				return setApiResponse(HTTP.ACCEPTED, 'USER_PHONE_OTP_SENT', 'A verification code has been sent to your phone.');
			}

			return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Provide email + password or a valid phone number');
		},

		logout: async (ctx: IFonderieContext): Promise<Response> => {
			const token = extractRefreshToken(ctx);
			if (token) {
				await sessions.delete(token).catch(() => undefined);
			}

			return Response.json(
				{ reason: 'USER_LOGOUT', explanation: 'Logged out successfully.' },
				{
					status: 200,
					headers: {
						'Set-Cookie': [
							'access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
							'refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0',
						].join(', '),
					},
				},
			);
		},

		refresh: async (ctx: IFonderieContext): Promise<Response> => {
			const token = extractRefreshToken(ctx);
			if (!token) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_PARAMETER', 'No refresh token provided');
			}

			const payload = verifyToken(token, config);
			if (!payload || payload.type !== 'refresh') {
				return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Invalid refresh token');
			}

			const valid = await sessions.exists(token);
			if (!valid) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Session expired or already revoked');
			}

			const user = await users.findById(payload.sub);
			if (!user || user.suspended || user.deletedAt) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
			}

			await sessions.delete(token);
			const { accessToken, refreshToken } = issueTokenPair(user.id, config);
			await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

			return Response.json(
				{
					reason:      'TOKENS_REFRESHED',
					explanation: 'Tokens refreshed successfully.',
					result: { tokens: { access: accessToken, refresh: refreshToken } },
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

		forgotPassword: async (ctx: IFonderieContext): Promise<Response> => {
			const body  = ctx.meta['body'] as Record<string, unknown> | undefined;
			const email = body?.['email'];

			if (typeof email !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required');
			}

			const user = await users.findByEmail(email);
			if (!user) {
				return setApiResponse(HTTP.OK, 'PASSWORD_RESET_EMAIL_SENT', 'Password reset email sent (if account exists).');
			}

			const token     = randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
			await passwordReset.create(user.id, token, expiresAt);

			ctx.meta['message'] = {
				type:      'password-reset',
				recipient: { email, phone: null, deviceToken: null },
				data:      { token },
			} satisfies ICourierMessage;

			return setApiResponse(HTTP.OK, 'PASSWORD_RESET_EMAIL_SENT', 'Password reset email sent (if account exists).');
		},

		resetPassword: async (ctx: IFonderieContext): Promise<Response> => {
			const body     = ctx.meta['body'] as Record<string, unknown> | undefined;
			const token    = body?.['resetToken'] ?? body?.['token'];
			const password = body?.['password'];

			if (typeof token !== 'string' || typeof password !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'resetToken and password are required');
			}
			if (password.length < 8) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'password must be at least 8 characters');
			}

			const row = await passwordReset.find(token);
			if (!row || new Date() > row.expiresAt) {
				return setApiResponse(HTTP.BAD_REQUEST, 'PASSWORD_RESET_FAILED', 'Invalid or expired token');
			}

			const passwordHash = await hashPassword(password);
			await store.transaction(async tx => {
				await Promise.all([
					tx.query(`UPDATE fonderie_users SET password_hash = $1 WHERE id = $2`, [passwordHash, row.userId]),
					tx.query(`DELETE FROM fonderie_password_resets WHERE token = $1`, [token]),
				]);
			});

			return setApiResponse(HTTP.OK, 'PASSWORD_RESET_SUCCESSFUL', 'Password reset successfully.');
		},

		verifyEmail: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const pin  = body?.['pin'];

			if (typeof pin !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'pin is required');
			}

			const row = await emailVerif.find(pin);
			if (!row) {
				return setApiResponse(HTTP.BAD_REQUEST, 'EMAIL_VERIFICATION_FAILED', 'Invalid or expired pin');
			}

			if (new Date() > row.expiresAt) {
				return setApiResponse(HTTP.BAD_REQUEST, 'EMAIL_VERIFICATION_FAILED', 'Pin expired');
			}

			await store.transaction(async tx => {
				await Promise.all([
					tx.query(`UPDATE fonderie_users SET email_verified_at = now(), updated_at = now() WHERE id = $1`, [row.userId]),
					tx.query(`DELETE FROM fonderie_email_verifications WHERE token = $1`, [pin]),
				]);
			});

			const user = await users.findById(row.userId);
			if (!user) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			}

			return setApiResponse(HTTP.OK, 'EMAIL_VERIFIED', 'Email verified successfully.', {
				verified: true,
				email:    user.email,
			});
		},

		sendVerificationEmail: async (ctx: IFonderieContext): Promise<Response> => {
			if (ctx.user!.emailVerifiedAt) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'EMAIL_ALREADY_VERIFIED',
					'Your email address has already been verified. No further action is needed.',
				);
			}

			const pin       = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
			await emailVerif.replace(ctx.user!.id, pin, expiresAt);

			ctx.meta['message'] = {
				type:      'email-verification',
				recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
				data:      { pin },
			} satisfies ICourierMessage;

			return setApiResponse(HTTP.OK, 'VERIFICATION_EMAIL_SENT', 'Verification email sent', {
				stat:    'success',
				message: 'Verification email sent',
				data: {
					token:     pin,
					expiresAt: expiresAt.toISOString(),
					email:     ctx.user!.email,
				},
			});
		},
	};
}
