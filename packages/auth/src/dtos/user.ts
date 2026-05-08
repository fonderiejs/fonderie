import { stringOrEmpty, booleanOrFalse } from '@fonderie-js/core';

import type { IUser, IUserSkill, IUserPreferences } from '../types';

export interface IUserDTO {
	id:              string
	email:           string
	firstName:       string
	lastName:        string
	phone:           string
	avatarUrl:       string
	locale:          string
	timezone:        string
	isActive:        boolean
	lastLogin:       string
	skills:          IUserSkill[]
	preferences:     IUserPreferences
	isEmailVerified: boolean
	mfaEnabled:      boolean
	suspended:       boolean
	whitelist:       boolean
	ipWhitelist:     string[]
	createdAt:       string
	updatedAt:       string
}

const DEFAULT_PREFERENCES: IUserPreferences = {
	notifications: { email: true, inApp: true, sms: false, push: false },
	emailDigest:   'immediate',
	dateFormat:    'MM/DD/YYYY',
	timeFormat:    'hh:mm A',
}

export function toUserDTO(user: IUser): IUserDTO {
	return {
		id:              stringOrEmpty(user.id),
		email:           stringOrEmpty(user.email),
		firstName:       stringOrEmpty(user.firstName),
		lastName:        stringOrEmpty(user.lastName),
		phone:           stringOrEmpty(user.phone),
		avatarUrl:       stringOrEmpty(user.profileImageUrl),
		locale:          user.locale  || 'en-US',
		timezone:        user.timezone || 'UTC',
		isActive:        typeof user.isActive === 'boolean' ? user.isActive : true,
		lastLogin:       user.lastLogin instanceof Date ? user.lastLogin.toISOString() : '',
		skills:          Array.isArray(user.skills) ? user.skills : [],
		preferences:     user.preferences ?? DEFAULT_PREFERENCES,
		isEmailVerified: user.emailVerifiedAt !== null,
		mfaEnabled:      booleanOrFalse(user.mfaEnabled),
		suspended:       booleanOrFalse(user.suspended),
		whitelist:       booleanOrFalse(user.whitelist),
		ipWhitelist:     Array.isArray(user.ipWhitelist) ? user.ipWhitelist : [],
		createdAt:       user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
		updatedAt:       user.updatedAt instanceof Date ? user.updatedAt.toISOString() : '',
	}
}
