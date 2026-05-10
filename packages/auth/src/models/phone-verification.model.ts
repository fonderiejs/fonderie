import type { IStoreAdapter } from '@fonderie-js/store';

export interface IPhoneVerificationRecord {
	otp:       string;
	expiresAt: Date;
	firstName: string | null;
	lastName:  string | null;
}

export class PhoneVerificationModel {
	constructor(private store: IStoreAdapter) {}

	async upsert(
		phone:     string,
		otp:       string,
		expiresAt: Date,
		firstName: string | null = null,
		lastName:  string | null = null,
	): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_phone_verifications (phone, otp, expires_at, first_name, last_name)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (phone) DO UPDATE
			SET otp = $2, expires_at = $3, first_name = $4, last_name = $5, created_at = now()`,
			[phone, otp, expiresAt, firstName, lastName],
		);
	}

	async find(phone: string): Promise<IPhoneVerificationRecord | null> {
		const [row] = await this.store.query<{
			otp:        string;
			expires_at: Date;
			first_name: string | null;
			last_name:  string | null;
		}>(
			`SELECT otp, expires_at, first_name, last_name
			FROM fonderie_phone_verifications WHERE phone = $1`,
			[phone],
		);
		if (!row) return null;
		return {
			otp:       row.otp,
			expiresAt: new Date(row.expires_at),
			firstName: row.first_name,
			lastName:  row.last_name,
		};
	}

	async delete(phone: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_phone_verifications WHERE phone = $1`,
			[phone],
		);
	}
}
