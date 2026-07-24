import type { IStoreAdapter } from '@fonderie/store';

// Migrating an existing user base onto Fonderie auth. `UserModel.create` is for
// fresh sign-ups — it generates a new id and sets `created_at`/verification to
// their defaults. A migration needs the opposite: preserve each user's original
// identity so foreign keys still resolve and history isn't rewritten. Pair this
// with the `legacyVerify` config option: import the legacy password hash as-is,
// and Fonderie upgrades it to bcrypt on the user's first login (rehash-on-login).
export interface IImportUser {
	// Preserve the legacy id so existing foreign keys keep pointing at this user.
	// Must be a UUID (the column type); omit only if you are remapping ids and
	// will supply the freshly-generated one. Omitting lets Postgres generate one.
	id?: string;
	email: string;
	// The user's existing password hash, in whatever format the old system used.
	// Left untouched here; `legacyVerify` validates it on login, then it's
	// re-stored as bcrypt. Pass null for accounts with no password (e.g. OAuth).
	passwordHash?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	profileImageUrl?: string | null;
	locale?: string;
	timezone?: string;
	// Preserve verification state — don't force already-verified users to
	// re-verify. A Date marks the account verified; null/omitted leaves it
	// unverified.
	emailVerifiedAt?: Date | null;
	mfaEnabled?: boolean;
	// Preserve the original signup time; omitted defaults to now().
	createdAt?: Date;
}

// Insert one migrated user, preserving whichever identity fields are supplied
// and letting the table defaults fill the rest. Returns the row's id (the
// preserved one, or the generated one). Not idempotent by itself — run against a
// fresh target, or manage replay (truncate-and-reload) at the migration level.
export async function importUser(
	store: IStoreAdapter,
	user: IImportUser,
): Promise<{ id: string }> {
	const cols: string[] = [];
	const vals: unknown[] = [];
	const placeholders: string[] = [];
	const add = (col: string, val: unknown) => {
		cols.push(col);
		vals.push(val);
		placeholders.push(`$${vals.length}`);
	};

	if (user.id !== undefined) add('id', user.id);
	add('email', user.email.toLowerCase().trim());
	if (user.passwordHash !== undefined) add('password_hash', user.passwordHash);
	if (user.firstName !== undefined) add('first_name', user.firstName);
	if (user.lastName !== undefined) add('last_name', user.lastName);
	if (user.phone !== undefined) add('phone', user.phone);
	if (user.profileImageUrl !== undefined) add('profile_image_url', user.profileImageUrl);
	if (user.locale !== undefined) add('locale', user.locale);
	if (user.timezone !== undefined) add('timezone', user.timezone);
	if (user.emailVerifiedAt !== undefined) add('email_verified_at', user.emailVerifiedAt);
	if (user.mfaEnabled !== undefined) add('mfa_enabled', user.mfaEnabled);
	if (user.createdAt !== undefined) add('created_at', user.createdAt);

	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_users (${cols.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 RETURNING id`,
		vals,
	);
	if (!row) throw new Error('[auth] importUser: insert returned no row');
	return row;
}
