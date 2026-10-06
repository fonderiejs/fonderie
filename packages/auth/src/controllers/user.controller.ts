import { clearedTokenCookies, cookieHeaders } from '../services/cookies';
import { randomInt } from 'node:crypto';

import { setApiResponse, HTTP, dateOrEmpty, background, COURIER_FORMAT_KEY } from '@fonderie/core';
import type { IFonderieContext, ICourierMessage } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { IAuthConfig } from '../config';

import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import { MESSAGE_KEYS, EVENT_KEYS, type ISessionRevokedEvent } from '../config';
import { toUserDTO } from '../dtos/user';
import {
	toLoginHistoryPageDTO,
	decodeLoginCursor,
	toSessionDTO,
} from '../dtos/login-activity';
import type { IUser } from '../types';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { LoginEventModel } from '../models/login-event.model';
import type { LoginOutcome } from '../models/login-event.model';
import { EmailVerificationModel } from '../models/email-verification.model';
import { PhoneVerificationModel } from '../models/phone-verification.model';
import { normalizeEmailSafe } from '../services/email';
import { AccountDeletionModel } from '../models/account-deletion.model';
import { checkCooldown } from '../services/cooldown';
import { archivedAddressResponse, deletionDate } from '../services/pending-deletion';
import { verifySecondFactor } from '../services/second-factor';

// The deletion code: short-lived (a decision taken now), one request a minute.
const DELETION_CODE_TTL_MS = 15 * 60 * 1000;
const DELETION_CODE_COOLDOWN_MS = 60 * 1000;

function normalizePhone(phone: string): string {
	return phone.trim().replace(/[\s()\-\.]/g, '');
}

function isValidPhone(phone: unknown): phone is string {
	return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(normalizePhone(phone));
}

export function userController(store: IStoreAdapter, config: IAuthConfig, bus?: EventBus) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store, config.location);
	const loginEvents = new LoginEventModel(store, config.location);
	const emailVerif = new EmailVerificationModel(store);
	const phoneVerif = new PhoneVerificationModel(store);
	const deletions = new AccountDeletionModel(store);

	const deletionBlocked = async (userId: string): Promise<Response | null> => {
		for (const blocker of config.accountDeletion?.blockers ?? []) {
			const refusal = await blocker(userId);
			if (refusal) return setApiResponse(HTTP.CONFLICT, refusal.reason, refusal.explanation, refusal.details);
		}
		return null;
	};

	/**
	 * Archive the account in ONE statement: deleted (restorable), the channel
	 * later notices use, every session ended, and every one-time code that
	 * could still act on it removed — a reset link or verification code issued
	 * before must not work on the archived account. All or nothing.
	 */
	const archive = async (userId: string, channel: 'email' | 'sms' | null): Promise<Date> => {
		const [row] = await store.query<{ deletedAt: Date }>(
			`WITH archived AS (
			   UPDATE fonderie_users
			   SET deleted_at = now(), updated_at = now(), deletion_channel = $2, deletion_reminded_at = NULL
			   WHERE id = $1 AND deleted_at IS NULL
			   RETURNING id, deleted_at
			 ), sessions_ended AS (
			   DELETE FROM fonderie_sessions WHERE user_id = $1
			 ), resets AS (
			   DELETE FROM fonderie_password_resets WHERE user_id = $1
			 ), emails AS (
			   DELETE FROM fonderie_email_verifications WHERE user_id = $1
			 ), phones AS (
			   DELETE FROM fonderie_phone_verifications WHERE user_id = $1
			 ), codes AS (
			   DELETE FROM fonderie_account_deletion_codes WHERE user_id = $1
			 )
			 SELECT deleted_at AS "deletedAt" FROM archived`,
			[userId, channel],
		);
		return row ? new Date(row.deletedAt) : new Date();
	};

	const announceArchived = async (ctx: IFonderieContext, deletedAt: Date): Promise<void> => {
		const userId = ctx.user!.id;
		const reqId = ctx.meta['requestId'] as string | undefined;
		await background(bus?.emit(
			EVENT_KEYS.userDeleted,
			{ userId, deletedAt: deletedAt.toISOString(), deleteOn: deletionDate(deletedAt, config).toISOString() },
			reqId !== undefined ? { requestId: reqId } : undefined,
		));
		await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId, sids: null, reason: 'account-deleted' } satisfies ISessionRevokedEvent));
	};

	const archivedResponse = (deletedAt: Date): Response =>
		Response.json(
			{
				reason: 'ACCOUNT_DELETED',
				explanation: 'Account closed. It will be permanently deleted on the date shown; sign in before then to keep it.',
				result: { requestedAt: deletedAt.toISOString(), deleteOn: deletionDate(deletedAt, config).toISOString() },
			},
			{ status: 200, headers: cookieHeaders(clearedTokenCookies(config)) },
		);

	return {
		me: async (ctx: IFonderieContext): Promise<Response> => {
			const user = await users.findById(ctx.user!.id);
			if (!user) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			}

			return setApiResponse(HTTP.OK, 'USER_ACCOUNT_FETCHED', 'User account fetched successful.', {
				user: toUserDTO(user, ctx.user!.phoneVerified),
			});
		},

		// ── Login history (append-only; the caller's own attempts) ────────
		loginHistory: async (ctx: IFonderieContext): Promise<Response> => {
			const params = new URL(ctx.request.url).searchParams;
			const rawLimit = Number(params.get('limit') ?? 50);
			const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50;

			const outcomeParam = params.get('outcome');
			if (outcomeParam !== null && outcomeParam !== 'success' && outcomeParam !== 'failed') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', "outcome must be 'success' or 'failed'");
			}

			const cursorParam = params.get('cursor');
			let cursor: { createdAt: string; id: string } | null = null;
			if (cursorParam) {
				cursor = decodeLoginCursor(cursorParam);
				if (!cursor) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Invalid cursor');
				}
			}

			const query: Parameters<LoginEventModel['listByUser']>[0] = { userId: ctx.user!.id, limit };
			if (outcomeParam) query.outcome = outcomeParam as LoginOutcome;
			if (cursor) query.cursor = cursor;
			const from = params.get('from');
			const to = params.get('to');
			if (from) query.from = new Date(from);
			if (to) query.to = new Date(to);

			const page = await loginEvents.listByUser(query);
			return setApiResponse(
				HTTP.OK,
				'LOGIN_HISTORY_FETCHED',
				'Login history retrieved.',
				toLoginHistoryPageDTO(page),
			);
		},

		// ── Active sessions (live only; the caller's own) ─────────────────
		listSessions: async (ctx: IFonderieContext): Promise<Response> => {
			const rows = await sessions.listLiveByUser(ctx.user!.id);
			const currentSid = (ctx.user as { sid?: string | null }).sid ?? null;
			return setApiResponse(HTTP.OK, 'SESSIONS_FETCHED', 'Active sessions retrieved.', {
				sessions: rows.map((r) => toSessionDTO(r, currentSid)),
			});
		},

		terminateSession: async (ctx: IFonderieContext): Promise<Response> => {
			const id = (ctx.meta['params'] as Record<string, string> | undefined)?.['id'];
			if (!id) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Session not found');
			}
			const removed = await sessions.terminateByIdReturningSid(ctx.user!.id, id);
			if (removed === undefined) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Session not found');
			}
			// The signed-out device learns it now, not on its next request.
			await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId: ctx.user!.id, sids: [removed], reason: 'terminated' } satisfies ISessionRevokedEvent));
			return setApiResponse(HTTP.OK, 'SESSION_TERMINATED', 'Session terminated.', { id });
		},

		terminateOtherSessions: async (ctx: IFonderieContext): Promise<Response> => {
			const currentSid = (ctx.user as { sid?: string | null }).sid ?? null;
			if (!currentSid) {
				// Without a resolvable current session there is nothing to spare, so
				// refuse rather than nuke every session (which would include this one).
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'NO_CURRENT_SESSION',
					'Cannot terminate others without a current session context',
				);
			}
			const sids = await sessions.terminateOthersReturningSids(ctx.user!.id, currentSid);
			const count = sids.length;
			if (count) await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId: ctx.user!.id, sids, reason: 'terminated' } satisfies ISessionRevokedEvent));
			return setApiResponse(HTTP.OK, 'SESSIONS_TERMINATED', 'Other sessions terminated.', { count });
		},

		updateProfile: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;

			const allowed = ['firstName', 'lastName', 'avatarUrl'] as const;
			const fields: Record<string, unknown> = {};
			for (const key of allowed) {
				if (body?.[key] !== undefined) fields[key] = body[key];
			}

			if (Object.keys(fields).length === 0) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'Provide at least one of: firstName, lastName, avatarUrl',
				);
			}

			const row = await users.update(ctx.user!.id, fields);
			if (!row) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');
			}

			const updated = await users.findById(ctx.user!.id);
			return setApiResponse(HTTP.OK, 'PROFILE_UPDATED', 'Profile updated.', {
				user: toUserDTO(updated as IUser, ctx.user!.phoneVerified),
			});
		},

		updatePreferences: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;

			const fields: Parameters<typeof users.updatePreferences>[1] = {};

			if (typeof body?.['locale'] === 'string') fields.locale = body['locale'];
			if (typeof body?.['timezone'] === 'string') fields.timezone = body['timezone'];

			const prefKeys = ['notifications', 'emailDigest', 'dateFormat', 'timeFormat'] as const;
			const patch: Record<string, unknown> = {};
			for (const key of prefKeys) {
				if (body?.[key] !== undefined) patch[key] = body[key];
			}
			if (Object.keys(patch).length > 0) fields.patch = patch;

			const row = await users.updatePreferences(ctx.user!.id, fields);
			if (!row) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'Provide at least one preference field',
				);
			}

			const updated = await users.findById(ctx.user!.id);
			return setApiResponse(HTTP.OK, 'PREFERENCES_UPDATED', 'Preferences updated.', {
				user: toUserDTO(updated as IUser, ctx.user!.phoneVerified),
			});
		},

		updateEmail: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const newEmail = body?.['email'];

			const normalised = typeof newEmail === 'string' ? normalizeEmailSafe(newEmail) : null;
			if (!normalised) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'A valid email address is required',
				);
			}
			const oldEmail = ctx.user!.email;

			if (normalised === oldEmail) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'New email must differ from current email',
				);
			}

			const existing = await users.findByEmail(normalised);
			if (existing) {
				return setApiResponse(HTTP.CONFLICT, 'EMAIL_IN_USE', 'Email already in use');
			}
			// An account awaiting deletion still holds its address (design D6).
			if (await users.findArchivedByEmail(normalised)) return archivedAddressResponse();

			const pin = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
			// The change and the code for the new address, together; the unique
			// index — not the read above — decides a race for the address.
			if (!(await emailVerif.changeEmail(ctx.user!.id, normalised, pin, expiresAt))) {
				return setApiResponse(HTTP.CONFLICT, 'EMAIL_IN_USE', 'Email already in use');
			}

			await background(bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.emailVerification,
					locale: ctx.user!.locale,
					data: { pin },
					recipient: { email: normalised, phone: null, deviceToken: null },
				} satisfies ICourierMessage));
			if (oldEmail) {
				await background(bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.emailChanged,
						locale: ctx.user!.locale,
						data: { newEmail: normalised },
						recipient: { email: oldEmail, phone: null, deviceToken: null },
					} satisfies ICourierMessage));
			}

			return setApiResponse(
				HTTP.OK,
				'EMAIL_UPDATED',
				'Email updated. A verification code has been sent to your new address.',
				{
					email: normalised,
				},
			);
		},

		updatePhone: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const newPhone = body?.['phone'];

			if (!isValidPhone(newPhone)) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'A valid phone number is required',
				);
			}

			const normalised = normalizePhone(newPhone);

			const existing = await users.findByPhone(normalised);
			if (existing) {
				return setApiResponse(HTTP.CONFLICT, 'PHONE_IN_USE', 'Phone number already in use');
			}

			const otp = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
			await phoneVerif.upsert(ctx.user!.id, normalised, otp, expiresAt);
			await users.updatePhone(ctx.user!.id, normalised);

			await background(bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.phoneOtp,
					locale: ctx.user!.locale,
					data: { otp },
					recipient: { email: null, phone: normalised, deviceToken: null },
				} satisfies ICourierMessage));
			if (ctx.user!.email) {
				await background(bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.phoneChanged,
						locale: ctx.user!.locale,
						data: {},
						recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
					} satisfies ICourierMessage));
			}

			return setApiResponse(
				HTTP.OK,
				'PHONE_UPDATED',
				'Phone number updated. A verification code has been sent to your new number.',
				{
					phone: normalised,
				},
			);
		},

		changePassword: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const currentPassword = body?.['currentPassword'];
			const newPassword     = body?.['newPassword'];

			if (typeof currentPassword !== 'string' || !currentPassword) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'currentPassword is required');
			}
			if (typeof newPassword !== 'string' || newPassword.length < 8) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'newPassword must be at least 8 characters');
			}

			const user = await users.findById(ctx.user!.id);
			if (!user) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');

			const { hashPassword, verifyPassword } = await import('../services/password');
			const valid = await verifyPassword(currentPassword, user.passwordHash ?? '');
			if (!valid) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_CREDENTIAL', 'Current password is incorrect');
			}

			const hash = await hashPassword(newPassword);
			// The new password and the end of every session, in one statement: a
			// changed password invalidates any tokens an attacker (or the user's
			// old device) may still hold. The client must re-authenticate.
			await users.changePasswordEndingSessions(ctx.user!.id, hash);
			await background(bus?.emit(EVENT_KEYS.sessionRevoked, { userId: ctx.user!.id, sids: null, reason: 'password-changed' } satisfies ISessionRevokedEvent));

			return setApiResponse(HTTP.OK, 'PASSWORD_CHANGED', 'Password updated successfully.');
		},

		/**
		 * Remove an OAuth provider from the account.
		 *
		 * Refuses when the account has no password, because unlinking would
		 * then leave NO way to sign in — that is account deletion, not a
		 * settings toggle, and a user clicking "disconnect Google" is not
		 * asking for it. The check is inside the UPDATE's WHERE clause, so a
		 * password cannot disappear between the check and the write.
		 *
		 * Notifies the account's email either way: changing how an account can
		 * be signed into is a security event for its owner, who is not
		 * necessarily the person doing it.
		 */
		unlinkOauth: async (ctx: IFonderieContext): Promise<Response> => {
			const provider = String((ctx.meta['params'] as Record<string, string>)?.['provider'] ?? '');
			const current = await users.findById(ctx.user!.id);
			if (!current?.provider) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_LINKED', 'No sign-in provider is linked.');
			}
			if (provider && provider.toLowerCase() !== current.provider.toLowerCase()) {
				return setApiResponse(
					HTTP.NOT_FOUND,
					'NOT_LINKED',
					`This account is not linked to ${provider}.`,
				);
			}

			const removed = await users.clearProvider(ctx.user!.id);
			if (!removed) {
				return setApiResponse(
					HTTP.CONFLICT,
					'PASSWORD_REQUIRED',
					'Set a password before disconnecting this provider — it is currently the only way to sign in.',
				);
			}

			if (ctx.user!.email) {
				await background(bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.oauthUnlinked,
						locale: ctx.user!.locale,
						data: { provider: current.provider },
						recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
					} satisfies ICourierMessage));
			}
			return setApiResponse(HTTP.OK, 'OAUTH_UNLINKED', 'Sign-in provider removed.');
		},

		// Legacy one-call deletion (no code). Kept so existing apps keep working;
		// apps move to POST /users/me/deletion + /confirm (proof + notices).
		deleteMe: async (ctx: IFonderieContext): Promise<Response> => {
			const deletedAt = await archive(ctx.user!.id, null);
			await announceArchived(ctx, deletedAt);
			return archivedResponse(deletedAt);
		},

		/**
		 * Step 1 of deleting an account: a 6-digit code to the channel the person
		 * picks ('email' | 'sms' — an address on the account; receiving the code
		 * proves they hold it). Refused while a blocker objects (e.g. they own a
		 * team with other members — transfer it first).
		 */
		requestDeletion: async (ctx: IFonderieContext): Promise<Response> => {
			const user = ctx.user!;
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const channel = body?.['channel'] === 'sms' ? 'sms' : body?.['channel'] === 'email' ? 'email' : null;
			if (!channel) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', "channel must be 'email' or 'sms'");
			}
			const address = channel === 'email' ? user.email : user.phone;
			if (!address) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					channel === 'email' ? 'NO_EMAIL_ON_ACCOUNT' : 'NO_PHONE_ON_ACCOUNT',
					`There is no ${channel === 'email' ? 'email address' : 'phone number'} on this account to send the code to.`,
				);
			}
			const refused = await deletionBlocked(user.id);
			if (refused) return refused;

			const remainingMs = checkCooldown(await deletions.lastSentAt(user.id), DELETION_CODE_COOLDOWN_MS);
			if (remainingMs > 0) {
				const retryAfter = Math.ceil(remainingMs / 1000);
				return setApiResponse(HTTP.TOO_MANY_REQUESTS, 'VERIFICATION_COOLDOWN', `Wait ${retryAfter}s before requesting a new code.`, { retryAfter });
			}

			const code = randomInt(100000, 1000000).toString();
			await deletions.saveCode(user.id, code, channel, new Date(Date.now() + DELETION_CODE_TTL_MS));
			await background(bus?.emit(NOTIFICATION_EVENT, {
				type: MESSAGE_KEYS.accountDeletionCode,
				locale: user.locale,
				data: { code },
				recipient: channel === 'email'
					? { email: address, phone: null, deviceToken: null }
					: { email: null, phone: address, deviceToken: null },
			} satisfies ICourierMessage));

			return setApiResponse(HTTP.ACCEPTED, 'ACCOUNT_DELETION_CODE_SENT', 'A code to confirm the deletion was sent.', {
				channel,
				expiresInSeconds: DELETION_CODE_TTL_MS / 1000,
				mfaRequired: user.mfaEnabled === true,
			});
		},

		/**
		 * Step 2: the code (and, with two-factor on, a second factor) archives the
		 * account — closed at once, restorable at sign-in until the purge date.
		 */
		confirmDeletion: async (ctx: IFonderieContext): Promise<Response> => {
			const user = ctx.user!;
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const code = typeof body?.['code'] === 'string' ? body['code'].trim() : '';
			if (!/^\d{6}$/.test(code)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'code must be the 6-digit code that was sent');
			}
			// Re-check: something may have changed since the code was sent.
			const refused = await deletionBlocked(user.id);
			if (refused) return refused;
			if (user.mfaEnabled && !(await verifySecondFactor(store, config, user.id, body?.['mfaCode']))) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'MFA_REQUIRED', 'Enter a code from your authenticator app (or a backup code) to confirm.');
			}
			const checked = await deletions.checkCode(user.id, code);
			if (checked.result !== 'ok') {
				return setApiResponse(HTTP.BAD_REQUEST, 'VERIFICATION_FAILED',
					checked.result === 'exhausted' || checked.result === 'none' || checked.result === 'expired'
						? 'This code can no longer be used. Request a new one.'
						: 'That code is incorrect.');
			}

			const deletedAt = await archive(user.id, checked.channel ?? null);
			await announceArchived(ctx, deletedAt);
			const deleteOn = deletionDate(deletedAt, config);
			const address = checked.channel === 'sms' ? user.phone : user.email;
			if (address) {
				await background(bus?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.accountDeletionScheduled,
					locale: user.locale,
					data: {
						deleteOn: deleteOn.toISOString().slice(0, 10),
						[COURIER_FORMAT_KEY]: { deleteOn: { date: deleteOn.toISOString(), style: 'long' } },
					},
					recipient: checked.channel === 'sms'
						? { email: null, phone: address, deviceToken: null }
						: { email: address, phone: null, deviceToken: null },
				} satisfies ICourierMessage));
			}
			return archivedResponse(deletedAt);
		},

		// Subject Access Request — the authenticated user's own data as a portable
		// JSON bundle. Only auth-owned data, and only safe fields: no password hash,
		// no MFA secret, no session tokens (session metadata only).
		exportMe: async (ctx: IFonderieContext): Promise<Response> => {
			const user = await users.findById(ctx.user!.id);
			if (!user) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'User not found');

			const sessionRows = await sessions.listByUser(ctx.user!.id);
			const bundle = {
				exportedAt: new Date().toISOString(),
				profile: toUserDTO(user, ctx.user!.phoneVerified),
				sessions: sessionRows.map((s) => ({
					id: s.id,
					userAgent: s.userAgent,
					ipAddress: s.ipAddress,
					createdAt: dateOrEmpty(s.createdAt),
					expiresAt: dateOrEmpty(s.expiresAt),
				})),
				security: {
					mfaEnabled: user.mfaEnabled === true,
					emailVerified: user.emailVerifiedAt !== null,
				},
			};

			// SAR completeness: other modules contribute the caller's data they own
			// (workspaces memberships, billing, …) without auth importing them — the
			// app wires collectors via config.dataExportContributors.
			const contributors = config.dataExportContributors ?? [];
			if (contributors.length > 0) {
				const modules: Record<string, unknown> = {};
				for (const c of contributors) {
					try {
						modules[c.name] = await c.collect(ctx.user!.id);
					} catch {
						modules[c.name] = null; // a failing contributor never blocks the export
					}
				}
				(bundle as Record<string, unknown>)['modules'] = modules;
			}

			return setApiResponse(HTTP.OK, 'DATA_EXPORT', 'Your account data.', bundle);
		},
	};
}
