import type { IStoreAdapter } from '@fonderie-js/store';
import type { IUser }          from '../types';

export interface IUserUpdateFields {
	firstName?:   string;
	lastName?:    string;
	phoneNumber?: string;
	avatarUrl?:   string;
	locale?:      string;
	timezone?:    string;
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
	mfa_secret         AS "mfaSecret",
	email_verified_at  AS "emailVerifiedAt",
	deleted_at         AS "deletedAt",
	created_at         AS "createdAt",
	updated_at         AS "updatedAt"
`;

export class UserModel {
	constructor(private store: IStoreAdapter) {}

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
		phone:     string,
		firstName: string | null = null,
		lastName:  string | null = null,
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
		email:        string,
		passwordHash: string,
		firstName:    string | null,
		lastName:     string | null,
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
			firstName:   'first_name',
			lastName:    'last_name',
			phoneNumber: 'phone',
			avatarUrl:   'profile_image_url',
			locale:      'locale',
			timezone:    'timezone',
			preferences: 'preferences',
		};

		const sets:   string[]  = [];
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

	async updatePassword(id: string, passwordHash: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET password_hash = $1 WHERE id = $2`,
			[passwordHash, id],
		);
	}

	async markEmailVerified(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET email_verified_at = now(), updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	async softDelete(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET deleted_at = now(), updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	async saveMfaSecret(id: string, secret: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET mfa_secret = $1 WHERE id = $2`,
			[secret, id],
		);
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
		await this.store.query(
			`UPDATE fonderie_users SET mfa_enabled = true WHERE id = $1`,
			[id],
		);
	}

	async disableMfa(id: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET mfa_enabled = false, mfa_secret = NULL, updated_at = now() WHERE id = $1`,
			[id],
		);
	}

	async updateEmail(id: string, email: string): Promise<void> {
		await this.store.transaction(async tx => {
			await Promise.all([
				tx.query(
					`UPDATE fonderie_users SET email = $1, email_verified_at = NULL, updated_at = now() WHERE id = $2`,
					[email.toLowerCase().trim(), id],
				),
				tx.query(
					`DELETE FROM fonderie_email_verifications WHERE user_id = $1`,
					[id],
				),
			]);
		});
	}

	async updatePhone(id: string, phone: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_users SET phone = $1, updated_at = now() WHERE id = $2`,
			[phone, id],
		);
	}

	async updatePreferences(id: string, fields: {
		locale?:   string;
		timezone?: string;
		patch?:    Record<string, unknown>;
	}): Promise<{ id: string } | null> {
		const sets:   string[]  = [];
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

	async upsertByProvider(
		email:      string,
		provider:   string,
		providerId: string,
	): Promise<{ id: string } | null> {
		const [row] = await this.store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, email_verified_at, provider, provider_id)
			VALUES ($1, now(), $2, $3)
			ON CONFLICT (email) DO UPDATE
			SET provider = $2, provider_id = $3
			RETURNING id`,
			[email, provider, providerId],
		);
		return row ?? null;
	}
}
