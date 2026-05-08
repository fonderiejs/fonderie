import type { IStoreAdapter } from '@fonderie-js/store';

import type { IUser }          from '../types';

const USER_COLUMNS = `
	id,
	email,
	password_hash      AS "passwordHash",
	first_name         AS "firstName",
	last_name          AS "lastName",
	phone,
	profile_image_url  AS "profileImageUrl",
	locale,
	timezone,
	is_active          AS "isActive",
	last_login         AS "lastLogin",
	skills,
	preferences,
	suspended,
	whitelist,
	ip_whitelist       AS "ipWhitelist",
	mfa_enabled        AS "mfaEnabled",
	mfa_secret         AS "mfaSecret",
	email_verified_at  AS "emailVerifiedAt",
	deleted_at         AS "deletedAt",
	created_at         AS "createdAt",
	updated_at         AS "updatedAt"
`;

export async function findUserById(
	id: string,
	store: IStoreAdapter,
): Promise<IUser | null> {
	const [row] = await store.query<IUser>(
		`SELECT ${USER_COLUMNS}
		FROM fonderie_users
		WHERE id = $1
			AND deleted_at IS NULL`,
		[id],
	);

	return row ?? null
}

export async function createSession(
	userId:       string,
	refreshToken: string,
	expiresAt:    Date,
	store:        IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_sessions (user_id, token, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (token) DO NOTHING`,
		[userId, refreshToken, expiresAt],
	)
}

export async function deleteSession(
	refreshToken: string,
	store:        IStoreAdapter,
): Promise<void> {
	await store.query(
		`DELETE FROM fonderie_sessions WHERE token = $1`,
		[refreshToken],
	)
}

export async function sessionExists(
	refreshToken: string,
	store:        IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ id: string }>(
		`SELECT id FROM fonderie_sessions
		WHERE token = $1 AND expires_at > now()`,
		[refreshToken],
	)
	return rows.length > 0
}

export async function findUserByEmail(
	email: string,
	store: IStoreAdapter,
): Promise<IUser | null> {
	const [row] = await store.query<IUser>(
		`SELECT ${USER_COLUMNS}
		FROM fonderie_users
		WHERE email = $1
			AND deleted_at IS NULL`,
		[email],
	);

	return row ?? null
}
