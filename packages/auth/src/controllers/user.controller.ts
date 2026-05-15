import { randomInt } from 'node:crypto';

import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext, ICourierMessage } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { EventBus } from '@fonderie-js/events';
import { NOTIFICATION_EVENT } from '@fonderie-js/events';

import { MESSAGE_KEYS, EVENT_KEYS } from '../config';
import { toUserDTO } from '../dtos/user';
import type { IUser } from '../types';
import { UserModel } from '../models/user.model';
import { EmailVerificationModel } from '../models/email-verification.model';
import { PhoneVerificationModel } from '../models/phone-verification.model';

function isValidPhone(phone: unknown): phone is string {
	return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(phone.trim());
}

export function userController(store: IStoreAdapter, bus?: EventBus) {
	const users = new UserModel(store);
	const emailVerif = new EmailVerificationModel(store);
	const phoneVerif = new PhoneVerificationModel(store);

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

			if (typeof newEmail !== 'string' || !newEmail.includes('@')) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'A valid email address is required',
				);
			}

			const normalised = newEmail.toLowerCase().trim();
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

			const pin = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
			await emailVerif.replace(ctx.user!.id, pin, expiresAt);
			await users.updateEmail(ctx.user!.id, normalised);

			bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.emailVerification,
					data: { pin },
					recipient: { email: normalised, phone: null, deviceToken: null },
				} satisfies ICourierMessage)
				.catch(() => {});
			if (oldEmail) {
				bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.emailChanged,
						data: { newEmail: normalised },
						recipient: { email: oldEmail, phone: null, deviceToken: null },
					} satisfies ICourierMessage)
					.catch(() => {});
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

			const normalised = newPhone.trim();

			const existing = await users.findByPhone(normalised);
			if (existing) {
				return setApiResponse(HTTP.CONFLICT, 'PHONE_IN_USE', 'Phone number already in use');
			}

			const otp = randomInt(100000, 1000000).toString();
			const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
			await phoneVerif.upsert(ctx.user!.id, normalised, otp, expiresAt);
			await users.updatePhone(ctx.user!.id, normalised);

			bus
				?.emit(NOTIFICATION_EVENT, {
					type: MESSAGE_KEYS.phoneOtp,
					data: { otp },
					recipient: { email: null, phone: normalised, deviceToken: null },
				} satisfies ICourierMessage)
				.catch(() => {});
			if (ctx.user!.email) {
				bus
					?.emit(NOTIFICATION_EVENT, {
						type: MESSAGE_KEYS.phoneChanged,
						data: {},
						recipient: { email: ctx.user!.email, phone: null, deviceToken: null },
					} satisfies ICourierMessage)
					.catch(() => {});
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
			await users.updatePassword(ctx.user!.id, hash);

			return setApiResponse(HTTP.OK, 'PASSWORD_CHANGED', 'Password updated successfully.');
		},

		deleteMe: async (ctx: IFonderieContext): Promise<Response> => {
			const userId = ctx.user!.id;
			await users.softDelete(userId);

			const reqId = ctx.meta['requestId'] as string | undefined;
			bus
				?.emit(
					EVENT_KEYS.userDeleted,
					{ userId },
					reqId !== undefined ? { requestId: reqId } : undefined,
				)
				.catch(() => {});

			return Response.json(
				{ reason: 'ACCOUNT_DELETED', explanation: 'Account successfully deleted.' },
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
	};
}
