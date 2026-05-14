import type { IStoreAdapter } from '@fonderie-js/store';

export class PhoneVerificationModel {
	constructor(private store: IStoreAdapter) {}

	async upsert(userId: string, phone: string, otp: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_phone_verifications (phone, user_id, otp, expires_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (phone) DO UPDATE
			SET user_id = $2, otp = $3, expires_at = $4, created_at = now()`,
			[phone, userId, otp, expiresAt],
		);
	}

	async findByUser(
		userId: string,
		otp: string,
	): Promise<{ phone: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ phone: string; expires_at: Date }>(
			`SELECT phone, expires_at FROM fonderie_phone_verifications WHERE user_id = $1 AND otp = $2`,
			[userId, otp],
		);
		if (!row) return null;
		return { phone: row.phone, expiresAt: new Date(row.expires_at) };
	}

	async findLastSentAt(userId: string): Promise<Date | null> {
		const [row] = await this.store.query<{ created_at: Date }>(
			`SELECT created_at FROM fonderie_phone_verifications WHERE user_id = $1`,
			[userId],
		);
		if (!row) return null;
		return new Date(row.created_at);
	}

	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_phone_verifications WHERE user_id = $1`, [userId]);
	}
}
