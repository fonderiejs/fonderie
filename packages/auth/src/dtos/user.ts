import { stringOrEmpty, booleanOrFalse } from '@fonderie/core';

import type { IUser, IUserPreferences } from '../types';

export interface IUserDTO {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone: string;
	profileImageUrl: string;
	isActive: boolean;
	lastLogin: string;
	preferences: IUserPreferences;
	isEmailVerified: boolean;
	isPhoneVerified: boolean;
	mfaEnabled: boolean;
	suspended: boolean;
	whitelist: boolean;
	ipWhitelist: string[];
	createdAt: string;
	updatedAt: string;
}

const DEFAULT_PREFERENCES: IUserPreferences = {
	locale: 'en-US',
	timezone: 'UTC',
	notifications: { email: true, inApp: true, sms: false, push: false },
	emailDigest: 'immediate',
	dateFormat: 'MM/DD/YYYY',
	timeFormat: 'hh:mm A',
};

// Historical rows may hold garbage preferences (the update schema accepted
// `unknown` for four keys until it was typed). Only well-typed values
// survive into the DTO, and notifications deep-merge over the defaults so a
// partial stored object can't shrink the shape the client type promises.
function cleanPreferences(prefs: IUserPreferences): Partial<IUserPreferences> {
	const out: Partial<IUserPreferences> = {};
	if (typeof prefs.locale === 'string') out.locale = prefs.locale;
	if (typeof prefs.timezone === 'string') out.timezone = prefs.timezone;
	if (typeof prefs.emailDigest === 'string') out.emailDigest = prefs.emailDigest;
	if (typeof prefs.dateFormat === 'string') out.dateFormat = prefs.dateFormat;
	if (typeof prefs.timeFormat === 'string') out.timeFormat = prefs.timeFormat;
	return out;
}

function cleanNotifications(value: unknown): Partial<IUserPreferences['notifications']> {
	if (!value || typeof value !== 'object') return {};
	const out: Partial<IUserPreferences['notifications']> = {};
	for (const key of ['email', 'inApp', 'sms', 'push'] as const) {
		const v = (value as Record<string, unknown>)[key];
		if (typeof v === 'boolean') out[key] = v;
	}
	return out;
}

export function toUserDTO(user: IUser, phoneVerified = false): IUserDTO {
	const prefs = user.preferences ?? ({} as IUserPreferences);
	const cleaned = cleanPreferences(prefs);
	return {
		id: stringOrEmpty(user.id),
		email: stringOrEmpty(user.email),
		firstName: stringOrEmpty(user.firstName),
		lastName: stringOrEmpty(user.lastName),
		phone: stringOrEmpty(user.phone),
		profileImageUrl: stringOrEmpty(user.profileImageUrl),
		isActive: typeof user.isActive === 'boolean' ? user.isActive : true,
		lastLogin: user.lastLogin instanceof Date ? user.lastLogin.toISOString() : '',
		preferences: {
			...DEFAULT_PREFERENCES,
			...cleaned,
			notifications: {
				...DEFAULT_PREFERENCES.notifications,
				...cleanNotifications(prefs.notifications),
			},
			locale: user.locale || cleaned.locale || 'en-US',
			timezone: user.timezone || cleaned.timezone || 'UTC',
		},
		isEmailVerified: user.emailVerifiedAt !== null,
		isPhoneVerified: phoneVerified,
		mfaEnabled: booleanOrFalse(user.mfaEnabled),
		suspended: booleanOrFalse(user.suspended),
		whitelist: booleanOrFalse(user.whitelist),
		ipWhitelist: Array.isArray(user.ipWhitelist) ? user.ipWhitelist : [],
		createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
		updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : '',
	};
}
