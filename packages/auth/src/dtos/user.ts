import { stringOrEmpty, booleanOrFalse } from '@fonderie-js/core';

import type { IUser } from '../types';

export interface IUserDTO {
	id:              string
	email:           string
	firstName:       string
	lastName:        string
	phone:           string
	profileImageUrl: string
	locale:          string
	timezone:        string
	isEmailVerified: boolean
	mfaEnabled:      boolean
	suspended:       boolean
	createdAt:       string
	updatedAt:       string
}

export function toUserDTO(user: IUser): IUserDTO {
	return {
		id:              stringOrEmpty(user.id),
		email:           stringOrEmpty(user.email),
		firstName:       stringOrEmpty(user.firstName),
		lastName:        stringOrEmpty(user.lastName),
		phone:           stringOrEmpty(user.phone),
		profileImageUrl: stringOrEmpty(user.profileImageUrl),
		locale:          user.locale || 'en-US',
		timezone:        user.timezone || 'UTC',
		isEmailVerified: user.emailVerifiedAt !== null,
		mfaEnabled:      booleanOrFalse(user.mfaEnabled),
		suspended:       booleanOrFalse(user.suspended),
		createdAt:       user.createdAt instanceof Date ? user.createdAt.toISOString() : '',
		updatedAt:       user.updatedAt instanceof Date ? user.updatedAt.toISOString() : '',
	}
}
