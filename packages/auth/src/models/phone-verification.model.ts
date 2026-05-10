import type { IStoreAdapter } from '@fonderie-js/store';

export class PhoneVerificationModel {
	constructor(private store: IStoreAdapter) {}

	async upsert(phone: string, otp: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_phone_verifications (phone, otp, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (phone) DO UPDATE
			SET otp = $2, expires_at = $3, created_at = now()`,
			[phone, otp, expiresAt],
		);
	}

	async find(phone: string): Promise<{ otp: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ otp: string; expires_at: Date }>(
			`SELECT otp, expires_at FROM fonderie_phone_verifications WHERE phone = $1`,
			[phone],
		);
		if (!row) return null;
		return { otp: row.otp, expiresAt: new Date(row.expires_at) };
	}

	async delete(phone: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_phone_verifications WHERE phone = $1`,
			[phone],
		);
	}
}
