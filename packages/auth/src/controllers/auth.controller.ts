import { tokenPairCookies, clearedTokenCookies, cookieHeaders } from '../services/cookies';
import { randomBytes, randomInt } from 'node:crypto';

import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import { setApiResponse, HTTP, background, canonicalLocale, defineLocales } from '@fonderie/core';
import type { IFonderieContext, ICourierMessage, ILocaleSettings } from '@fonderie/core';

import { EVENT_KEYS, type ISessionRevokedEvent } from '../config';
import { toUserDTO } from '../dtos/user';
import type { IAuthConfig } from '../config';
import { UserModel } from '../models/user.model';
import { checkCooldown } from '../services/cooldown';
import { SessionModel } from '../models/session.model';
import { LoginEventModel } from '../models/login-event.model';
import { requestMeta } from '../services/request-meta';
import { hashPassword, verifyPasswordForLogin } from '../services/password';
import { normalizeEmailSafe } from '../services/email';
import { archivedAddressResponse, pendingDeletionResponse } from '../services/pending-deletion';
import { verifyRestoreToken } from '../services/restore-token';
import { verifySecondFactor } from '../services/second-factor';
import { PasswordResetModel, hashSecret } from '../models/password-reset.model';
import { DEFAULT_VERIFICATION_COOLDOWN, MESSAGE_KEYS } from '../config';
import { EmailVerificationModel } from '../models/email-verification.model';
import { PhoneVerificationModel } from '../models/phone-verification.model';
import {
	issueTokenPair,
	issueMfaPendingToken,
	verifyToken,
	refreshTokenExpiry,
	durationMs,
} from '../services/jwt';
import { clientKindOf, configForClient } from '../services/session-policy';

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

export function authController(
	store: IStoreAdapter,
	config: IAuthConfig,
	bus?: EventBus,
	locales: ILocaleSettings = defineLocales(),
) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store, config.location);
	const loginEvents = new LoginEventModel(store, config.location);
	const passwordReset = new PasswordResetModel(store);
	const emailVerif = new EmailVerificationModel(store);
	const phoneVerif = new PhoneVerificationModel(store);

	const OTP_TTL_MS = 10 * 60 * 1000;

	return {
		register: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const { email, password, phone, firstName = null, lastName = null } = body ?? {};
			// The language the person signed up in, so the very first email — the
			// verification code — already arrives in it. Else the app's system locale.
			const locale = canonicalLocale(body?.['locale'] as string | undefined) ?? locales.default;

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
				// The address still belongs to an archived account until its purge:
				// a second account here would be a 500 (unique email) and would
				// strand the first. Point the person at keeping it instead.
				if (await users.findArchivedByEmail(normalizedEmail)) return archivedAddressResponse();

				const passwordHash = await hashPassword(password);
				const row = await users.create(
					normalizedEmail,
					passwordHash,
					firstName as string | null,
					lastName as string | null,
					locale,
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
				await background(bus
					?.emit(
						NOTIFICATION_EVENT,
						{
							type: MESSAGE_KEYS.emailRegistration,
							locale: user.locale,
							data: { pin, firstName: firstName ?? '' },
							recipient: { email: normalizedEmail, phone: null, deviceToken: null },
						} satisfies ICourierMessage,
						reqOpts,
					));
				await background(bus
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
					));

				const { accessToken, refreshToken, sid } = issueTokenPair(user.id, configForClient(config, config.resolve?.(ctx), clientKindOf(ctx.request.headers)), {
					loginMethod: 'email',
				});
				const registerMeta = requestMeta(ctx);
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken), sid, registerMeta);
				// Where the account was created from — the user's first entry in
				// their own history. Location resolves once for this request (the
				// session above already asked).
				await loginEvents.recordSafe({
					userId: user.id,
					emailAttempted: normalizedEmail,
					method: 'registration',
					outcome: 'success',
					...registerMeta,
				});

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
						headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)),
					},
				);
			}

			// ── Phone branch ──────────────────────────────────────────
			if (isValidPhone(phone)) {
				const existing = await users.findByPhone(normalizePhone(phone));
				if (existing) {
					return setApiResponse(HTTP.CONFLICT, 'USER_ALREADY_EXISTS', 'Phone already registered');
				}
				// Before findOrCreateByPhone: its ON CONFLICT (phone) would rewrite the
				// archived account's name and then fail.
				if (await users.findArchivedByPhone(normalizePhone(phone))) return archivedAddressResponse();

				const { id } = await users.findOrCreateByPhone(
					normalizePhone(phone),
					(firstName as string | null) ?? null,
					(lastName as string | null) ?? null,
					locale,
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
				await background(bus
					?.emit(
						NOTIFICATION_EVENT,
						{
							type: MESSAGE_KEYS.phoneOtp,
							locale: user.locale,
							data: { otp },
							recipient: { email: null, phone: normalizePhone(phone), deviceToken: null },
						} satisfies ICourierMessage,
						reqOpts2,
					));
				await background(bus
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
					));

				// No session and no full tokens before the OTP round-trip: possession
				// of the phone is the ONLY credential in this flow, so issuing real
				// tokens here would authenticate anyone who typed the number. Mirror
				// the MFA flow instead — a short-lived pending token that only
				// /auth/verify and /auth/send-verification accept; the real token
				// pair is issued by verify() once the OTP matches.
				const otpToken = issueMfaPendingToken(user.id, config, 'phone');

				return Response.json(
					{
						reason: 'USER_PHONE_REGISTERED',
						explanation: 'Account created. A verification code has been sent to your phone.',
						result: {
							otpToken,
							user: toUserDTO(user),
						},
					},
					{ status: 202 },
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
			const meta = requestMeta(ctx);

			// ── Email branch takes priority (cheaper than SMS) ────────
			if (typeof body?.['email'] === 'string' && typeof body?.['password'] === 'string') {
				const { email: rawEmail, password } = body as { email: string; password: string };
				const email = normalizeEmailSafe(rawEmail);
				if (!email) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid email address');
				}

				const user = await users.findByEmail(email);
				if (!user) {
					// An archived account says so — but only to someone who knows its
					// password; a wrong one is the same 401 as an unknown address.
					const archived = await users.findArchivedByEmail(email);
					if (archived?.passwordHash && archived.deletedAt) {
						const { valid } = await verifyPasswordForLogin(password, archived.passwordHash, config.legacyVerify);
						await loginEvents.recordSafe({
							userId: archived.id,
							emailAttempted: email,
							method: 'password',
							outcome: 'failed',
							failureReason: valid ? 'pending_deletion' : 'bad_password',
							...meta,
						});
						if (valid) return pendingDeletionResponse({ ...archived, deletedAt: archived.deletedAt }, 'email', config);
						return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
					}
				}
				if (!user || !user.passwordHash) {
					await loginEvents.recordSafe({
						userId: null,
						emailAttempted: email,
						method: 'password',
						outcome: 'failed',
						failureReason: 'unknown_email',
						...meta,
					});
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				const { valid, needsRehash } = await verifyPasswordForLogin(
					password,
					user.passwordHash,
					config.legacyVerify,
				);
				if (!valid) {
					await loginEvents.recordSafe({
						userId: user.id,
						emailAttempted: email,
						method: 'password',
						outcome: 'failed',
						failureReason: 'bad_password',
						...meta,
					});
					return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
				}

				// Rehash-on-login: a password validated via the legacy verifier is
				// re-stored as bcrypt so the foreign hash is used at most once.
				if (needsRehash) {
					await users.updatePassword(user.id, await hashPassword(password));
				}

				if (user.suspended) {
					return setApiResponse(
						HTTP.FORBIDDEN,
						'ACCOUNT_SUSPENDED',
						'Account suspended. Please contact support.',
					);
				}

				if (user.mfaEnabled) {
					// Password verified; MFA still pending. The completed login is
					// recorded on mfa/verify — recording success here would log a
					// login that hasn't happened yet.
					const mfaToken = issueMfaPendingToken(user.id, config, 'email');
					return setApiResponse(HTTP.OK, 'MFA_REQUIRED', 'Multi-factor authentication required', {
						mfaToken,
					});
				}

				const { accessToken, refreshToken, sid } = issueTokenPair(user.id, configForClient(config, config.resolve?.(ctx), clientKindOf(ctx.request.headers)), {
					loginMethod: 'email',
				});
				await sessions.create(user.id, refreshToken, refreshTokenExpiry(refreshToken), sid, meta);
				await loginEvents.recordSafe({
					userId: user.id,
					emailAttempted: email,
					method: 'password',
					outcome: 'success',
					...meta,
				});

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
						headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)),
					},
				);
			}

			// ── Phone branch ──────────────────────────────────────────
			const phone = body?.['phone'];
			if (isValidPhone(phone)) {
				// An archived account gets a code like any other: the code it proves
				// leads, at /auth/verify, to "scheduled for deletion — keep it?".
				const user = (await users.findByPhone(normalizePhone(phone))) ?? (await users.findArchivedByPhone(normalizePhone(phone)));
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
				// Within the cooldown no new text goes out (anyone who knows a
				// number could flood it); the code already sent stays valid, and
				// the answer is the same either way.
				const loginCooldown = { ...config, ...config.resolve?.(ctx) }.verificationCooldown ?? DEFAULT_VERIFICATION_COOLDOWN;
				if (await phoneVerif.claimSend(user.id, normalizePhone(phone), otp, expiresAt, loginCooldown)) {
					await background(bus
						?.emit(NOTIFICATION_EVENT, {
							type: MESSAGE_KEYS.phoneOtp,
							locale: user.locale,
							data: { otp },
							recipient: { email: null, phone: normalizePhone(phone), deviceToken: null },
						} satisfies ICourierMessage));
				}

				// Same rule as phone registration: the OTP IS the credential, so no
				// session/full tokens until verify() confirms it. Also no user DTO —
				// before proof of possession, the caller has only typed a phone
				// number, and returning profile data would leak PII to anyone who
				// knows (or guesses) a registered number.
				const otpToken = issueMfaPendingToken(user.id, config, 'phone');

				return Response.json(
					{
						reason: 'USER_PHONE_OTP_SENT',
						explanation: 'A verification code has been sent to your phone.',
						result: { otpToken },
					},
					{ status: 202 },
				);
			}

			return setApiResponse(
				HTTP.UNPROCESSABLE,
				'INVALID_PARAMETER',
				'Provide email + password or a valid phone number',
			);
		},

		/**
		 * "Keep my account": the restoreToken from a sign-in to an archived account
		 * (proof already given: password, Google / Apple, phone code), plus a
		 * second factor when two-factor is on. Un-archives in one statement —
		 * only the SAME archive the proof was for — then signs the person in.
		 */
		restoreAccount: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const proof = verifyRestoreToken(String(body?.['restoreToken'] ?? ''), config);
			const invalid = () => setApiResponse(HTTP.UNAUTHORIZED, 'RESTORE_TOKEN_INVALID', 'Sign in again to keep your account.');
			if (!proof) return invalid();
			const archived = await users.findArchivedById(proof.sub);
			if (!archived?.deletedAt || archived.deletedAt.toISOString() !== proof.archivedAt) return invalid();
			if (archived.suspended) {
				return setApiResponse(HTTP.FORBIDDEN, 'ACCOUNT_SUSPENDED', 'Account suspended. Please contact support.');
			}
			if (archived.mfaEnabled && !(await verifySecondFactor(store, config, archived.id, body?.['mfaCode']))) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'MFA_REQUIRED', 'Enter a code from your authenticator app (or a backup code) to keep your account.');
			}

			const [restored] = await store.query<{ channel: string | null }>(
				`UPDATE fonderie_users
				 SET deleted_at = NULL, deletion_channel = NULL, deletion_reminded_at = NULL, updated_at = now()
				 -- The SAME archive the proof was for. Postgres keeps microseconds,
				 -- the proof (a JS date) milliseconds: compare at that precision.
				 WHERE id = $1 AND date_trunc('milliseconds', deleted_at) = date_trunc('milliseconds', $2::timestamptz)
				 RETURNING (SELECT deletion_channel FROM fonderie_users WHERE id = $1) AS channel`,
				[archived.id, proof.archivedAt],
			);
			if (!restored) return invalid();

			const meta = requestMeta(ctx);
			const method = proof.loginMethod === 'google' ? 'oauth-google' : proof.loginMethod === 'apple' ? 'oauth-apple' : proof.loginMethod === 'phone' ? 'phone' : 'password';
			const { accessToken, refreshToken, sid } = issueTokenPair(archived.id, configForClient(config, config.resolve?.(ctx), clientKindOf(ctx.request.headers)), {
				loginMethod: proof.loginMethod,
				phoneVerified: proof.loginMethod === 'phone',
			});
			await sessions.create(archived.id, refreshToken, refreshTokenExpiry(refreshToken), sid, meta);
			await loginEvents.recordSafe({ userId: archived.id, emailAttempted: archived.email, method, outcome: 'success', ...meta });

			const reqId = ctx.meta['requestId'] as string | undefined;
			await background(bus?.emit(EVENT_KEYS.userRestored, { userId: archived.id }, reqId !== undefined ? { requestId: reqId } : undefined));
			const viaSms = restored.channel === 'sms' || (!archived.email && !!archived.phone);
			const address = viaSms ? archived.phone : archived.email;
			if (address) {
				await background(bus?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.accountRestored,
					locale: archived.locale,
					data: {},
					recipient: viaSms ? { email: null, phone: address, deviceToken: null } : { email: address, phone: null, deviceToken: null },
				} satisfies ICourierMessage));
			}

			const user = await users.findById(archived.id);
			return Response.json(
				{
					reason: 'ACCOUNT_RESTORED',
					explanation: 'Your account is active again.',
					result: { tokens: { access: accessToken, refresh: refreshToken }, user: user ? toUserDTO(user) : null },
				},
				{ status: 200, headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)) },
			);
		},

		logout: async (ctx: IFonderieContext): Promise<Response> => {
			// Kill the session this request is authenticated on — by its sid claim,
			// which is always present under requireAuth. This is the reliable path:
			// clients that don't resend the refresh token (most, since only the
			// access token is persisted) previously left the session row alive, so
			// it lingered in Active Sessions and its refresh token stayed valid.
			const sid = (ctx.user as { sid?: string | null } | null)?.sid;
			if (sid) {
				await sessions.deleteBySid(sid).catch(() => undefined);
			}
			// Also honour an explicitly-passed refresh token (covers pre-sid tokens
			// and callers that log out a specific refresh session).
			const token = extractRefreshToken(ctx);
			if (token) {
				await sessions.delete(token).catch(() => undefined);
			}

			return Response.json(
				{ reason: 'USER_LOGOUT', explanation: 'Logged out successfully.' },
				{
					status: 200,
					headers: cookieHeaders(clearedTokenCookies(config)),
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

			// The session is a device: a refresh rotates the same row. The previous
			// token stays valid for a short grace (a retry, or two racing requests);
			// presented after it, it is a reuse — someone else holds an old copy —
			// and the session is revoked. docs/SESSION-DESIGN.md, Phase 2.
			// Lifetimes as the console sets them now — not the boot config — and for
			// the platform the session was opened on (recorded at sign-in; the
			// request's own header is ignored here, so it cannot promote itself).
			const runtime = config.resolve?.(ctx);
			let issued: { accessToken: string; refreshToken: string } | null = null;
			for (let attempt = 0; attempt < 3 && !issued; attempt++) {
				const found = await sessions.match(token);
				if (found.kind === 'unknown') {
					return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Session expired or already revoked');
				}
				if (found.kind === 'reused') {
					await sessions.revokeById(found.row.id);
					await background(
						bus?.emit(EVENT_KEYS.sessionRevoked, { userId: found.row.userId, sids: [found.row.sid], reason: 'refresh-reuse' } satisfies ISessionRevokedEvent),
					);
					return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Session expired or already revoked');
				}
				const resolvedRefresh = configForClient(config, runtime, found.row.clientKind);
				const maxAgeMs = resolvedRefresh.sessionMaxAge ? durationMs(String(resolvedRefresh.sessionMaxAge)) : null;
				// Absolute cap: however active, a session this old signs in again.
				if (maxAgeMs !== null && Date.now() - found.row.createdAt.getTime() > maxAgeMs) {
					await sessions.revokeById(found.row.id);
					return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Session reached its maximum age — sign in again');
				}
				const user = await users.findById(found.row.userId);
				if (!user || user.suspended || user.deletedAt || user.id !== payload.sub) {
					return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
				}
				const pair = issueTokenPair(user.id, resolvedRefresh, {
					loginMethod: payload.loginMethod ?? 'email',
					phoneVerified: payload.phoneVerified ?? false,
					...(found.row.sid ? { sid: found.row.sid } : {}),
					// A refresh is not a sign-in: keep when the user last signed in.
					...(typeof payload.auth_time === 'number' ? { authTime: payload.auth_time } : {}),
				});
				// Lost a race to a concurrent rotation of the same session: match again.
				const next = { token: pair.refreshToken, expiresAt: refreshTokenExpiry(pair.refreshToken) };
				if (await sessions.rotate(found.row, token, next, found.kind)) issued = pair;
			}
			if (!issued) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'TOKEN_REFRESH_FAILED', 'Session expired or already revoked');
			}
			const { accessToken, refreshToken } = issued;

			return Response.json(
				{
					reason: 'TOKENS_REFRESHED',
					explanation: 'Tokens refreshed successfully.',
					result: { tokens: { access: accessToken, refresh: refreshToken } },
				},
				{
					status: 200,
					headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)),
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
			// High-entropy token backing a reset LINK (32 bytes → 64 hex chars).
			// Not brute-forceable, so its reset path needs no rate limit.
			const token = randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
			await passwordReset.create(user.id, pin, token, expiresAt);

			// Ready-built reset link when the app configured a base URL; '' means
			// the app only surfaces the pin (a blank {{resetUrl}} renders empty).
			const base = resolved.passwordResetUrl;
			const resetUrl = base ? `${base}${base.includes('?') ? '&' : '?'}token=${token}` : '';

			await background(bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.passwordReset,
					locale: user.locale,
					recipient: { email, phone: null, deviceToken: null },
					data: { pin, token, resetUrl },
				} satisfies ICourierMessage));

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

			const rawToken = body?.['token'];

			if (typeof password !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'password is required');
			}
			if (password.length < 8) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'password must be at least 8 characters',
				);
			}

			// Two credentials redeem a reset: the strong TOKEN (from the email
			// link — not brute-forceable) or the 6-digit PIN (route is
			// IP-rate-limited). Token takes precedence when both are supplied.
			let row: { userId: string; expiresAt: Date } | null;
			let presented: string;
			if (typeof rawToken === 'string' && rawToken.trim().length >= 32) {
				presented = rawToken.trim();
				row = await passwordReset.findByToken(presented);
			} else {
				if (typeof raw !== 'string' || !/^\d{6}$/.test(raw.trim())) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_PARAMETER',
						'a 6-digit pin or a reset token is required',
					);
				}
				presented = raw.trim();
				row = await passwordReset.findByPin(presented);
			}

			if (!row || new Date() > row.expiresAt) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'PASSWORD_RESET_FAILED',
					'Invalid or expired reset credentials',
				);
			}

			const passwordHash = await hashPassword(password);
			// One statement: set the password, spend the reset code, end every
			// session (the reset exists because the account may be compromised — a
			// stolen session must not survive it). `deleted_at IS NULL` in the same
			// statement: a code issued before the account was deleted never changes
			// the archived account — same answer as an invalid code, no oracle.
			const [changed] = await store.query<{ id: string }>(
				`WITH spent AS (
				   -- The code is spent HERE, and only what this statement spent
				   -- changes a password: two resets racing with one code — the
				   -- second finds it gone and changes nothing.
				   DELETE FROM fonderie_password_resets
				   WHERE user_id = $2 AND (pin = $3 OR token = $3) AND expires_at > now()
				   RETURNING user_id
				 ), changed AS (
				   UPDATE fonderie_users SET password_hash = $1, updated_at = now()
				   WHERE id IN (SELECT user_id FROM spent) AND deleted_at IS NULL
				   RETURNING id
				 ), revoked AS (
				   DELETE FROM fonderie_sessions WHERE user_id IN (SELECT id FROM changed)
				 )
				 SELECT id FROM changed`,
				[passwordHash, row.userId, hashSecret(presented)],
			);
			if (!changed) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'PASSWORD_RESET_FAILED',
					'Invalid or expired reset credentials',
				);
			}

			return setApiResponse(HTTP.OK, 'PASSWORD_RESET_SUCCESSFUL', 'Password reset successfully.');
		},

		verify: async (ctx: IFonderieContext): Promise<Response> => {
			// requireAnyAuth admits pending tokens so the phone-OTP flow can reach
			// this route pre-authentication — but a pending token is ONLY valid for
			// that flow. An email mfaPending token (password verified, MFA not) must
			// finish MFA at /auth/mfa/verify, not side-step into email verification.
			if (ctx.user!.mfaPending && ctx.user!.loginMethod !== 'phone') {
				return setApiResponse(HTTP.FORBIDDEN, 'MFA_REQUIRED', 'Complete MFA verification to continue');
			}

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
				// A phone sign-in COMPLETES here, not in login(): /auth/login only
				// sends the code and issues a pending token, because possession of
				// the phone is the sole credential. That is why login history missed
				// this path for months — an audit of "where do logins happen" reads
				// login() and the OAuth callbacks, and never a route named verify.
				const phoneMeta = requestMeta(ctx);
				// Consumed in ONE statement: a right code works once (two racing
				// requests used to both sign in), a wrong one spends a try, five
				// spend the code.
				const used = await phoneVerif.consume(ctx.user!.id, pin);
				if (used === 'invalid' || used === 'exhausted') {
					await loginEvents.recordSafe({
						userId: ctx.user!.id,
						emailAttempted: null,
						method: 'phone',
						outcome: 'failed',
						failureReason: used === 'exhausted' ? 'pin_exhausted' : 'invalid_pin',
						...phoneMeta,
					});
					return setApiResponse(
						HTTP.BAD_REQUEST,
						'VERIFICATION_FAILED',
						used === 'exhausted' ? 'Too many wrong codes. Request a new one.' : 'Invalid or expired pin',
					);
				}
				if (used === 'expired') {
					await loginEvents.recordSafe({
						userId: ctx.user!.id,
						emailAttempted: null,
						method: 'phone',
						outcome: 'failed',
						failureReason: 'expired_pin',
						...phoneMeta,
					});
					return setApiResponse(
						HTTP.BAD_REQUEST,
						'VERIFICATION_FAILED',
						'Verification code expired',
					);
				}
				// The phone is proven. An archived account is told when it will be
				// deleted and offered to keep it — never handed a session.
				if (ctx.user!.deletedAt) {
					await loginEvents.recordSafe({
						userId: ctx.user!.id,
						emailAttempted: null,
						method: 'phone',
						outcome: 'failed',
						failureReason: 'pending_deletion',
						...phoneMeta,
					});
					return pendingDeletionResponse({ ...ctx.user!, deletedAt: ctx.user!.deletedAt }, 'phone', config);
				}

				// The account BEFORE any session: a suspended one used to get a
				// session row (refresh token stored) and only then the refusal.
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

				const { accessToken, refreshToken, sid } = issueTokenPair(ctx.user!.id, configForClient(config, config.resolve?.(ctx), clientKindOf(ctx.request.headers)), {
					loginMethod: 'phone',
					phoneVerified: true,
				});
				await sessions.create(ctx.user!.id, refreshToken, refreshTokenExpiry(refreshToken), sid, phoneMeta);
				await loginEvents.recordSafe({
					userId: ctx.user!.id,
					emailAttempted: null,
					method: 'phone',
					outcome: 'success',
					...phoneMeta,
				});

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
						headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)),
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
			// Same pending-token rule as verify(): admitted only for the phone-OTP
			// flow (resending the code), never for an email MFA-pending login.
			if (ctx.user!.mfaPending && ctx.user!.loginMethod !== 'phone') {
				return setApiResponse(HTTP.FORBIDDEN, 'MFA_REQUIRED', 'Complete MFA verification to continue');
			}

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

				const otp = randomInt(100000, 1000000).toString();
				const expiresAt = new Date(Date.now() + OTP_TTL_MS);
				// Claimed in ONE statement: parallel resends cannot each send a text.
				const remaining = (await phoneVerif.claimSend(ctx.user!.id, phone, otp, expiresAt, cooldown))
					? 0
					: Math.max(checkCooldown(await phoneVerif.findLastSentAt(ctx.user!.id), cooldown), 1000);
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


				await background(bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.phoneOtp,
						locale: ctx.user!.locale,
						data: { otp },
						recipient: { email: null, phone, deviceToken: null },
					} satisfies ICourierMessage));

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

			await background(bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.emailVerification,
					locale: ctx.user!.locale,
					recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
					data: { pin },
				} satisfies ICourierMessage));

			return setApiResponse(HTTP.OK, 'VERIFICATION_SENT', 'Verification email sent.', {
				email: ctx.user!.email,
			});
		},
	};
}
