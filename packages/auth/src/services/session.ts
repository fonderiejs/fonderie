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
	suspended,
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
