import type { IStoreAdapter } from '@fonderie/store';
import type { IUser } from '../types';

export interface IUserUpdateFields {
	firstName?: string;
	lastName?: string;
	phoneNumber?: string;
	avatarUrl?: string;
	locale?: string;
	timezone?: string;
	preferences?: unknown;
}

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
	preferences,
	suspended,
	whitelist,
	ip_whitelist       AS "ipWhitelist",
	mfa_enabled        AS "mfaEnabled",
	email_verified_at  AS "emailVerifiedAt",
	provider,
	deleted_at         AS "deletedAt",
	created_at         AS "createdAt",
	updated_at         AS "updatedAt"
`;

export class UserModel {
	constructor(private store: IStoreAdapter) {}

	// One page of users, newest first. Keyset-paginated on (created_at, id) —
	// the same cursor contract as login history and the audit log. The +1
	// over-fetch that detects a next page lives here so no outer clamp can
	// shave it off. Soft-deleted rows are excluded, as in every other finder.
	async list(query: IUserListQuery = {}): Promise<IUserPage> {
		const limit = Math.min(query.limit ?? 50, MAX_LIST_LIMIT);
		const params: unknown[] = [];
		const where: string[] = ['deleted_at IS NULL'];

		if (query.cursor) {
			params.push(query.cursor.createdAt, query.cursor.id);
			where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
		}

		params.push(limit + 1);
		const rows = await this.store.query<IUser & { createdAtRaw?: string }>(
			`SELECT ${USER_COLUMNS}, created_at::text AS "createdAtRaw"
			 FROM   fonderie_users
			 WHERE  ${where.join(' AND ')}
			 ORDER  BY created_at DESC, id DESC
			 LIMIT  $${params.length}`,
			params,
		);
		return { users: rows.slice(0, limit), hasMore: rows.length > limit };
	}

	async findById(id: string): Promise<IUser | null> {
		const [row] = await this.store.query<IUser>(
			`SELECT ${USER_COLUMNS} FROM fonderie_users WHERE id = $1 AND deleted_at IS NULL`,
			[id],
		);
		return row ?? null;
	}

	async findByEmail(email: string): Promise<IUser | null> {
		const [row] = await this.store.query<IUser>(
			`SELECT ${USER_COLUMNS} FROM fonderie_users WHERE email = $1 AND deleted_at IS NULL`,
			[email],
		);
		return row ?? null;
	}

	async findByPhone(phone: string): Promise<IUser | null> {
		const [row] = await this.store.query<IUser>(
			`SELECT ${USER_COLUMNS} FROM fonderie_users WHERE phone = $1 AND deleted_at IS NULL`,
			[phone],
		);
		return row ?? null;
	}

	async findOrCreateByPhone(
		phone: string,
		firstName: string | null = null,
		lastName: string | null = null,
	): Promise<{ id: string }> {
		const [row] = await this.store.query<{ id: string }>(
			`INSERT INTO fonderie_users (phone, first_name, last_name)
			VALUES ($1, $2, $3)
			ON CONFLICT (phone) DO UPDATE
			SET first_name = COALESCE(EXCLUDED.first_name, fonderie_users.first_name),
			    last_name  = COALESCE(EXCLUDED.last_name,  fonderie_users.last_name),
			    updated_at = now()
			RETURNING id`,
			[phone, firstName, lastName],
		);
		return row!;
	}

	async create(
		email: string,
		passwordHash: string,
		firstName: string | null,
		lastName: string | null,
	): Promise<{ id: string } | null> {
		const [row] = await this.store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, password_hash, first_name, last_name)
			VALUES ($1, $2, $3, $4)
			RETURNING id`,
			[email.toLowerCase().trim(), passwordHash, firstName, lastName],
		);
		return row ?? null;
	}

	async update(id: string, fields: IUserUpdateFields): Promise<{ id: string } | null> {
		const columnMap: Record<string, string> = {
			firstName: 'first_name',
			lastName: 'last_name',
			phoneNumber: 'phone',
			avatarUrl: 'profile_image_url',
			locale: 'locale',
			timezone: 'timezone',
			preferences: 'preferences',
		};

		const sets: string[] = [];
		const values: unknown[] = [];

		for (const [key, col] of Object.entries(columnMap)) {
			if ((fields as Record<string, unknown>)[key] !== undefined) {
				values.push((fields as Record<string, unknown>)[key]);
				sets.push(`${col} = $${values.length}`);
			}
		}

		values.push(id);
		const [row] = await this.store.query<{ id: string }>(
			`UPDATE fonderie_users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
			values,
		);
		return row ?? null;
	}

	/**
	 * Clear the OAuth provider, but ONLY when the account can still be signed
	 * into afterwards.
	 *
	 * An account created through Google has no password. Unlinking it without
	 * checking would not be "removing a sign-in method" — it would be locking
	 * the owner out permanently, which is account deletion wearing a friendlier
	 * label. The guard lives in the WHERE clause so the check and the write are
	 * one atomic statement: a password cannot be removed between them.
	 *
	 * Returns false when the account has no password (nothing was changed) so
	 * the caller can say why rather than reporting a silent success.
	 */
	async clearProvider(id: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`UPDATE fonderie_users
			    SET provider = NULL, provider_id = NULL
			  WHERE id = $1
			    AND password_hash IS NOT NULL
			    AND provider IS NOT NULL
			 RETURNING id`,
			[id],
		);
		return rows.length > 0;
	}

	async updatePassword(id: string, passwordHash: string): Promise<void> {
		await this.store.query(`UPDATE fonderie_users SET password_hash = $1 WHERE id = $2`, [
			passwordHash,
			id,
		]);
	}

	async markEmailVerified(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET email_verified_at = now(), updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	// The operator's lock: login, refresh and the session middleware all refuse a
	// suspended user. Returns false when there is no such user.
	async setSuspended(id: string, suspended: boolean): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`UPDATE fonderie_users SET suspended = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
			[id, suspended],
		);
		return rows.length > 0;
	}

	async softDelete(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET deleted_at = now(), updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	async saveMfaSecret(id: string, secret: string): Promise<void> {
		await this.store.query(`UPDATE fonderie_users SET mfa_secret = $1 WHERE id = $2`, [secret, id]);
	}

	async saveMfaPendingSecret(id: string, secret: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users
			 SET mfa_secret_pending = $1, mfa_secret_pending_expires_at = now() + interval '15 minutes'
			 WHERE id = $2`,
			[secret, id],
		);
	}

	async getMfaPendingSecret(id: string): Promise<string | null> {
		const [row] = await this.store.query<{ mfa_secret_pending: string | null }>(
			`SELECT mfa_secret_pending FROM fonderie_users
			 WHERE id = $1 AND mfa_secret_pending_expires_at > now()`,
			[id],
		);
		return row?.mfa_secret_pending ?? null;
	}

	async confirmMfaSecret(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users
			 SET mfa_secret                    = mfa_secret_pending,
			     mfa_secret_pending            = NULL,
			     mfa_secret_pending_expires_at = NULL,
			     mfa_enabled                   = true,
			     updated_at                    = now()
			 WHERE id = $1`,
			[id],
		);
	}

	async enableMfa(id: string): Promise<void> {
		await this.store.query(`UPDATE fonderie_users SET mfa_enabled = true WHERE id = $1`, [id]);
	}

	async disableMfa(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET mfa_enabled = false, mfa_secret = NULL, updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	async updateEmail(id: string, email: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET email = $1, email_verified_at = NULL, updated_at = now() WHERE id = $2`,
			[email.toLowerCase().trim(), id],
		);
	}

	async updatePhone(id: string, phone: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET phone = $1, updated_at = now() WHERE id = $2`,
			[phone, id],
		);
	}

	async updatePreferences(
		id: string,
		fields: {
			locale?: string;
			timezone?: string;
			patch?: Record<string, unknown>;
		},
	): Promise<{ id: string } | null> {
		const sets: string[] = [];
		const values: unknown[] = [];

		if (fields.locale !== undefined) {
			values.push(fields.locale);
			sets.push(`locale = $${values.length}`);
		}
		if (fields.timezone !== undefined) {
			values.push(fields.timezone);
			sets.push(`timezone = $${values.length}`);
		}
		if (fields.patch && Object.keys(fields.patch).length > 0) {
			values.push(JSON.stringify(fields.patch));
			sets.push(`preferences = preferences || $${values.length}::jsonb`);
		}

		if (sets.length === 0) return null;

		values.push(id);
		const [row] = await this.store.query<{ id: string }>(
			`UPDATE fonderie_users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} AND deleted_at IS NULL RETURNING id`,
			values,
		);
		return row ?? null;
	}

	async getMfaSecret(id: string): Promise<string | null> {
		const [row] = await this.store.query<{ mfa_secret: string | null }>(
			`SELECT mfa_secret FROM fonderie_users WHERE id = $1`,
			[id],
		);
		return row?.mfa_secret ?? null;
	}

	/**
	 * Link an OAuth identity to the account owning `email`, creating it if there
	 * is none.
	 *
	 * Returns what HAPPENED, not just who it happened to. Three outcomes hide
	 * behind one upsert, and callers must tell them apart:
	 *
	 *   • `inserted` — a brand-new account. Whoever provisions on signup (the
	 *     personal workspace, a wallet, a welcome email) must run, exactly as
	 *     it does for a password registration. This is the case that was
	 *     previously invisible: the upsert returned an id and looked identical
	 *     to a returning user signing in, so OAuth signups silently skipped
	 *     every signup side effect.
	 *   • `previousProvider` differs — an existing account gained, or switched,
	 *     a way to sign in. A security event for the owner.
	 *   • `previousProvider` is the same — an ordinary login. Nothing to do, and
	 *     notifying here would email the user on every single sign-in.
	 *
	 * The prior state is read in a CTE of the SAME statement, so it sees the
	 * snapshot from before the insert. Reading it in a separate query would
	 * race two concurrent logins into both seeing "new".
	 *
	 * SECURITY — linking is BY EMAIL, so this merges into whatever row already
	 * holds the address. If that row was never verified, its password was never
	 * proven to belong to the mailbox; anyone can register an address they do
	 * not own. The provider HAS proven ownership. So an unverified password is
	 * revoked at the moment of linking: without that, linking sets
	 * email_verified_at and the earlier registrant is left holding a working
	 * password on an account now treated as verified.
	 *
	 * The legitimate user loses nothing but a password reset — they own the
	 * mailbox. Someone who does not own it cannot receive that mail.
	 */
	async upsertByProvider(
		email: string,
		provider: string,
		providerId: string,
	): Promise<{
		id: string;
		inserted: boolean;
		previousProvider: string | null;
		clearedUnverifiedPassword: boolean;
	} | null> {
		const [row] = await this.store.query<{
			id: string;
			inserted: boolean;
			previousProvider: string | null;
			clearedUnverifiedPassword: boolean;
		}>(
			`WITH prior AS (
				SELECT provider, email_verified_at, password_hash IS NOT NULL AS had_password
				  FROM fonderie_users WHERE email = $1
			), upserted AS (
				INSERT INTO fonderie_users (email, email_verified_at, provider, provider_id)
				VALUES ($1, now(), $2, $3)
				ON CONFLICT (email) DO UPDATE
				SET provider = $2, provider_id = $3,
				    email_verified_at = COALESCE(fonderie_users.email_verified_at, now()),
				    -- A password on an UNVERIFIED account is a claim, not a
				    -- credential: nobody ever proved that mailbox belongs to
				    -- whoever set it. The provider has now proven it belongs to
				    -- the person signing in. Drop the unproven claim rather than
				    -- promote it — otherwise linking marks the account verified
				    -- and silently hands the earlier registrant a working
				    -- password on a now-trusted account.
				    password_hash = CASE
				      WHEN fonderie_users.email_verified_at IS NULL THEN NULL
				      ELSE fonderie_users.password_hash
				    END
				RETURNING id
			)
			SELECT upserted.id,
			       NOT EXISTS (SELECT 1 FROM prior)   AS inserted,
			       (SELECT provider FROM prior)       AS "previousProvider",
			       -- True only when a password was actually revoked, so the
			       -- caller can tell the owner their sign-in method changed.
			       COALESCE((SELECT had_password AND email_verified_at IS NULL FROM prior), false)
			         AS "clearedUnverifiedPassword"
			FROM upserted`,
			[email, provider, providerId],
		);
		return row ?? null;
	}
}

const MAX_LIST_LIMIT = 200;

export interface IUserListQuery {
	limit?: number;
	cursor?: { createdAt: string; id: string };
}

export interface IUserPage {
	// Carries createdAtRaw (created_at::text) so the cursor keeps the
	// microsecond precision a Date round-trip would drop.
	users: Array<IUser & { createdAtRaw?: string }>;
	hasMore: boolean;
}
