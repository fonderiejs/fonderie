import { tokenPairCookies, clearedTokenCookies } from '../services/cookies';
import { randomInt } from 'node:crypto';

import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext, ICourierMessage } from '@fonderie/core';

import { EVENT_KEYS } from '../config';
import { toUserDTO } from '../dtos/user';
import type { IAuthConfig } from '../config';
import { UserModel } from '../models/user.model';
import { checkCooldown } from '../services/cooldown';
import { SessionModel } from '../models/session.model';
import { hashPassword, verifyPassword } from '../services/password';
import { normalizeEmailSafe } from '../services/email';
import { PasswordResetModel } from '../models/password-reset.model';
import { DEFAULT_VERIFICATION_COOLDOWN, MESSAGE_KEYS } from '../config';
import { EmailVerificationModel } from '../models/email-verification.model';
import { PhoneVerificationModel } from '../models/phone-verification.model';
import {
	issueTokenPair,
	issueMfaPendingToken,
	verifyToken,
	refreshTokenExpiry,
} from '../services/jwt';

function normalizePhone(phone: string): string {
	return phone.trim().replace(/[\s()\-\.]/g, '');
}

function isValidPhone(phone: unknown): phone is string {
	return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(normalizePhone(phone));
}

function extractRefreshToken(ctx: IFonderieContext): string | null {
	const body = ctx.meta['body'] as Record<string, unknown> | undefined;
	if (typeof body?.['refreshToken'] === 'string') {
		return body['refreshToken'] as string;
	}

	const cookie = ctx.request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);

	return match?.[1] ?? null;
}

export function authController(store: IStoreAdapter, config: IAuthConfig, bus?: EventBus) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);
	const passwordReset = new PasswordResetModel(store);
	const emailVerif = new EmailVerificationModel(store);
	const phoneVerif = new PhoneVerificationModel(store);

	const OTP_TTL_MS = 10 * 60 * 1000;

	return {
		register: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const { email, password, phone, firstName = null, lastName = null } = body ?? {};

			// ── Email branch takes priority (cheaper than SMS) ───────
			if (typeof email === 'string' && typeof password === 'string') {
				const normalizedEmail = normalizeEmailSafe(email);
				if (!normalizedEmail) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid email address');
				}

				if (password.length < 8) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_PARAMETER',
						'password must be at least 8 characters',
					);
				}

				const existing = await users.findByEmail(normalizedEmail);
				if (existing) {
					return setApiResponse(HTTP.CONFLICT, 'USER_ALREADY_EXISTS', 'Email already registered');
				}

				const passwordHash = await hashPassword(password);
				const row = await users.create(
					normalizedEmail,
					passwordHash,
					firstName as string | null,
					lastName as string | null,
				);

				if (!row) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const pin = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
				await emailVerif.create(row.id, pin, expiresAt);

				const user = await users.findById(row.id);
				if (!user) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const reqId = ctx.meta['requestId'] as string | undefined;
				const reqOpts = reqId !== undefined ? { requestId: reqId } : undefined;
				bus
					?.emit(
						NOTIFICATION_EVENT,
						{
							type: MESSAGE_KEYS.emailRegistration,
							data: { pin, firstName: firstName ?? '' },
							recipient: { email: normalizedEmail, phone: null, deviceToken: null },
						} satisfies ICourierMessage,
						reqOpts,
					)
					.catch(() => {});
				bus
					?.emit(
						EVENT_KEYS.userRegistered,
						{
							userId: user.id,
							email: user.email,
							firstName: user.firstName,
							lastName: user.lastName,
							loginMethod: 'email' as const,
						},
						reqOpts,
					)
					.catch(() => {});

				const { accessToken, refreshToken } = issueTokenPair(user.id, config, {
					loginMethod: 'email',
				});
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				const resolvedRegister = { ...config, ...config.resolve?.(ctx) };
				const requiresVerification = !!(resolvedRegister.requireVerification) && !user.emailVerifiedAt;

				return Response.json(
					{
						reason: 'USER_EMAIL_REGISTERED',
						explanation: 'Account created. Check your email for a verification code.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user: toUserDTO(user),
							requiresVerification,
						},
					},
					{
						status: 201,
						headers: {
							'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
						},
					},
				);
			}

			// ── Phone branch ──────────────────────────────────────────
			if (isValidPhone(phone)) {
				const existing = await users.findByPhone(normalizePhone(phone));
				if (existing) {
					return setApiResponse(HTTP.CONFLICT, 'USER_ALREADY_EXISTS', 'Phone already registered');
				}

				const { id } = await users.findOrCreateByPhone(
					normalizePhone(phone),
					(firstName as string | null) ?? null,
					(lastName as string | null) ?? null,
				);

				const otp = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				await phoneVerif.upsert(id, normalizePhone(phone), otp, expiresAt);

				const user = await users.findById(id);
				if (!user) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Registration failed');
				}

				const reqId2 = ctx.meta['requestId'] as string | undefined;
				const reqOpts2 = reqId2 !== undefined ? { requestId: reqId2 } : undefined;
				bus
					?.emit(
						NOTIFICATION_EVENT,
						{
							type: MESSAGE_KEYS.phoneOtp,
							data: { otp },
							recipient: { email: null, phone: normalizePhone(phone), deviceToken: null },
						} satisfies ICourierMessage,
						reqOpts2,
					)
					.catch(() => {});
				bus
					?.emit(
						EVENT_KEYS.userRegistered,
						{
							userId: user.id,
							email: user.email,
							firstName: user.firstName,
							lastName: user.lastName,
							loginMethod: 'phone' as const,
						},
						reqOpts2,
					)
					.catch(() => {});

				const { accessToken, refreshToken } = issueTokenPair(user.id, config, {
					loginMethod: 'phone',
				});
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				return Response.json(
					{
						reason: 'USER_PHONE_REGISTERED',
						explanation: 'Account created. A verification code has been sent to your phone.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user: toUserDTO(user),
						},
					},
					{
						status: 202,
						headers: {
							'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
						},
					},
				);
			}

			return setApiResponse(
				HTTP.UNPROCESSABLE,
				'INVALID_PARAMETER',
				'Provide email + password or a valid phone number',
			);
		},

		login: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;

			// ── Email branch takes priority (cheaper than SMS) ────────
			if (typeof body?.['email'] === 'string' && typeof body?.['password'] === 'string') {
				const { email: rawEmail, password } = body as { email: string; password: string };
				const email = normalizeEmailSafe(rawEmail);
				if (!email) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid email address');
				}

				const user = await users.findByEmail(email);
				if (!user || !user.passwordHash) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				const valid = await verifyPassword(password, user.passwordHash);
				if (!valid) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				if (user.suspended) {
					return setApiResponse(
						HTTP.FORBIDDEN,
						'ACCOUNT_SUSPENDED',
						'Account suspended. Please contact support.',
					);
				}

				if (user.mfaEnabled) {
					const mfaToken = issueMfaPendingToken(user.id, config, 'email');
					return setApiResponse(HTTP.OK, 'MFA_REQUIRED', 'Multi-factor authentication required', {
						mfaToken,
					});
				}

				const { accessToken, refreshToken } = issueTokenPair(user.id, config, {
					loginMethod: 'email',
				});
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				const resolvedLogin = { ...config, ...config.resolve?.(ctx) };
				const requiresVerification = !!(resolvedLogin.requireVerification) && !user.emailVerifiedAt;

				return Response.json(
					{
						reason: 'USER_EMAIL_LOGIN',
						explanation: 'Login successful.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user: toUserDTO(user),
							requiresVerification,
						},
					},
					{
						status: 200,
						headers: {
							'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
						},
					},
				);
			}

			// ── Phone branch ──────────────────────────────────────────
			const phone = body?.['phone'];
			if (isValidPhone(phone)) {
				const user = await users.findByPhone(normalizePhone(phone));
				if (!user) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}
				if (user.suspended) {
					return setApiResponse(
						HTTP.FORBIDDEN,
						'ACCOUNT_SUSPENDED',
						'Account suspended. Please contact support.',
					);
				}

				const otp = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				await phoneVerif.upsert(user.id, normalizePhone(phone), otp, expiresAt);

				bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.phoneOtp,
						data: { otp },
						recipient: { email: null, phone: normalizePhone(phone), deviceToken: null },
					} satisfies ICourierMessage)
					.catch(() => {});

				const { accessToken, refreshToken } = issueTokenPair(user.id, config, {
					loginMethod: 'phone',
				});
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

				return Response.json(
					{
						reason: 'USER_PHONE_OTP_SENT',
						explanation: 'A verification code has been sent to your phone.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user: toUserDTO(user, false),
						},
					},
					{
						status: 202,
						headers: {
							'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
						},
					},
				);
			}

			return setApiResponse(
				HTTP.UNPROCESSABLE,
				'INVALID_PARAMETER',
				'Provide email + password or a valid phone number',
			);
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
						'Set-Cookie': clearedTokenCookies(config),
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
				return setApiResponse(
					HTTP.UNAUTHORIZED,
					'TOKEN_REFRESH_FAILED',
					'Session expired or already revoked',
				);
			}

			const user = await users.findById(payload.sub);
			if (!user || user.suspended || user.deletedAt) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
			}

			await sessions.delete(token);
			const { accessToken, refreshToken } = issueTokenPair(user.id, config, {
				loginMethod: payload.loginMethod ?? 'email',
				phoneVerified: payload.phoneVerified ?? false,
			});
			await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken));

			return Response.json(
				{
					reason: 'TOKENS_REFRESHED',
					explanation: 'Tokens refreshed successfully.',
					result: { tokens: { access: accessToken, refresh: refreshToken } },
				},
				{
					status: 200,
					headers: {
						'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
					},
				},
			);
		},

		forgotPassword: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const rawEmail = body?.['email'];

			if (typeof rawEmail !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required');
			}

			const email = normalizeEmailSafe(rawEmail);
			if (!email) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid email address');
			}

			const user = await users.findByEmail(email);
			if (!user) {
				return setApiResponse(
					HTTP.OK,
					'PASSWORD_RESET_EMAIL_SENT',
					'Password reset email sent (if account exists).',
				);
			}

			const resolved = { ...config, ...config.resolve?.(ctx) };
			const cooldown = resolved.verificationCooldown ?? DEFAULT_VERIFICATION_COOLDOWN;
			const remaining = checkCooldown(await passwordReset.findLastSentAt(user.id), cooldown);
			if (remaining > 0) {
				// Silently skip the send: a 429 here would fire only for existing
				// accounts, letting an attacker enumerate users by requesting twice.
				// The response must be indistinguishable from the not-found branch.
				return setApiResponse(
					HTTP.OK,
					'PASSWORD_RESET_EMAIL_SENT',
					'Password reset email sent (if account exists).',
				);
			}

			const pin = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
			await passwordReset.create(user.id, pin, expiresAt);

			bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.passwordReset,
					recipient: { email, phone: null, deviceToken: null },
					data: { pin },
				} satisfies ICourierMessage)
				.catch(() => {});

			return setApiResponse(
				HTTP.OK,
				'PASSWORD_RESET_EMAIL_SENT',
				'Password reset email sent (if account exists).',
			);
		},

		resetPassword: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const raw = body?.['pin'];
			const password = body?.['password'];

			if (typeof raw !== 'string' || typeof password !== 'string') {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'pin and password are required',
				);
			}

			if (!/^\d{6}$/.test(raw.trim())) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'pin must be a 6-digit code',
				);
			}

			if (password.length < 8) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'password must be at least 8 characters',
				);
			}

			const pin = raw.trim();
			const row = await passwordReset.findByPin(pin);
			if (!row || new Date() > row.expiresAt) {
				return setApiResponse(HTTP.BAD_REQUEST, 'PASSWORD_RESET_FAILED', 'Invalid or expired pin');
			}

			const passwordHash = await hashPassword(password);
			await store.transaction(async (tx) => {
				await Promise.all([
					tx.query(`UPDATE fonderie_users SET password_hash = $1 WHERE id = $2`, [
						passwordHash,
						row.userId,
					]),
					tx.query(`DELETE FROM fonderie_password_resets WHERE user_id = $1`, [row.userId]),
				]);
			});

			return setApiResponse(HTTP.OK, 'PASSWORD_RESET_SUCCESSFUL', 'Password reset successfully.');
		},

		verify: async (ctx: IFonderieContext): Promise<Response> => {
			// ── Email early-exit: no pin needed if already verified ──
			if (ctx.user!.loginMethod !== 'phone' && ctx.user!.emailVerifiedAt) {
				return setApiResponse(HTTP.OK, 'VERIFIED', 'Email verified successfully.', {
					verified: true,
					email: ctx.user!.email,
				});
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const raw = body?.['token'];

			if (typeof raw !== 'string' || !/^\d{6}$/.test(raw.trim())) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'token must be a 6-digit code',
				);
			}

			const pin = raw.trim();

			// ── Phone branch ─────────────────────────────────────────
			if (ctx.user!.loginMethod === 'phone') {
				const record = await phoneVerif.findByUser(ctx.user!.id, pin);
				if (!record) {
					return setApiResponse(HTTP.BAD_REQUEST, 'VERIFICATION_FAILED', 'Invalid or expired pin');
				}
				if (new Date() > record.expiresAt) {
					await phoneVerif.deleteByUser(ctx.user!.id);
					return setApiResponse(
						HTTP.BAD_REQUEST,
						'VERIFICATION_FAILED',
						'Verification code expired',
					);
				}
				await phoneVerif.deleteByUser(ctx.user!.id);

				const { accessToken, refreshToken } = issueTokenPair(ctx.user!.id, config, {
					loginMethod: 'phone',
					phoneVerified: true,
				});
				await sessions.create(ctx.user!.id, refreshToken, refreshTokenExpiry(refreshToken));

				const verifiedUser = await users.findById(ctx.user!.id);
				if (!verifiedUser) {
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
				}
				if (verifiedUser.suspended) {
					return setApiResponse(
						HTTP.FORBIDDEN,
						'ACCOUNT_SUSPENDED',
						'Account suspended. Please contact support.',
					);
				}

				return Response.json(
					{
						reason: 'VERIFIED',
						explanation: 'Phone verified successfully.',
						result: {
							tokens: { access: accessToken, refresh: refreshToken },
							user: toUserDTO(verifiedUser, true),
						},
					},
					{
						status: 200,
						headers: {
							'Set-Cookie': tokenPairCookies(accessToken, refreshToken, config),
						},
					},
				);
			}

			// ── Email branch ─────────────────────────────────────────
			const row = await emailVerif.findByUser(ctx.user!.id, pin);
			if (!row) {
				return setApiResponse(HTTP.BAD_REQUEST, 'VERIFICATION_FAILED', 'Invalid or expired pin');
			}
			if (new Date() > row.expiresAt) {
				return setApiResponse(HTTP.BAD_REQUEST, 'VERIFICATION_FAILED', 'Pin expired');
			}

			await store.transaction(async (tx) => {
				await Promise.all([
					tx.query(
						`UPDATE fonderie_users SET email_verified_at = now(), updated_at = now() WHERE id = $1`,
						[ctx.user!.id],
					),
					tx.query(`DELETE FROM fonderie_email_verifications WHERE user_id = $1 AND token = $2`, [
						ctx.user!.id,
						pin,
					]),
				]);
			});

			return setApiResponse(HTTP.OK, 'VERIFIED', 'Email verified successfully.', {
				verified: true,
				email: ctx.user!.email,
			});
		},

		sendVerification: async (ctx: IFonderieContext): Promise<Response> => {
			const resolved = { ...config, ...config.resolve?.(ctx) };
			const cooldown = resolved.verificationCooldown ?? DEFAULT_VERIFICATION_COOLDOWN;

			if (ctx.user!.loginMethod === 'phone') {
				const phone = ctx.user!.phone;
				if (!phone) {
					return setApiResponse(
						HTTP.BAD_REQUEST,
						'NO_PHONE_ON_ACCOUNT',
						'No phone number associated with this account',
					);
				}

				const remaining = checkCooldown(await phoneVerif.findLastSentAt(ctx.user!.id), cooldown);
				if (remaining > 0) {
					return setApiResponse(
						HTTP.TOO_MANY_REQUESTS,
						'VERIFICATION_COOLDOWN',
						'Please wait before requesting a new code.',
						{
							retryAfter: Math.ceil(remaining / 1000),
						},
					);
				}

				const otp = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				await phoneVerif.upsert(ctx.user!.id, phone, otp, expiresAt);

				bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.phoneOtp,
						data: { otp },
						recipient: { email: null, phone, deviceToken: null },
					} satisfies ICourierMessage)
					.catch(() => {});

				return setApiResponse(
					HTTP.OK,
					'VERIFICATION_SENT',
					'A verification code has been sent to your phone.',
				);
			}

			if (!ctx.user!.email) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'NO_EMAIL_ON_ACCOUNT',
					'No email address associated with this account',
				);
			}

			if (ctx.user!.emailVerifiedAt) {
				return setApiResponse(HTTP.OK, 'EMAIL_VERIFIED', 'Email already verified.', {
					verified: true,
					email: ctx.user!.email,
				});
			}

			const remaining = checkCooldown(await emailVerif.findLastSentAt(ctx.user!.id), cooldown);
			if (remaining > 0) {
				return setApiResponse(
					HTTP.TOO_MANY_REQUESTS,
					'VERIFICATION_COOLDOWN',
					'Please wait before requesting a new code.',
					{
						retryAfter: Math.ceil(remaining / 1000),
					},
				);
			}

			const pin = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
			await emailVerif.replace(ctx.user!.id, pin, expiresAt);

			bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.emailVerification,
					recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
					data: { pin },
				} satisfies ICourierMessage)
				.catch(() => {});

			return setApiResponse(HTTP.OK, 'VERIFICATION_SENT', 'Verification email sent.', {
				email: ctx.user!.email,
			});
		},
	};
}
