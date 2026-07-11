import type { IStoreAdapter } from '@fonderie/store';

export class BackupCodeModel {
	constructor(private store: IStoreAdapter) {}

	async replace(userId: string, codeHashes: string[]): Promise<void> {
		await this.store.transaction(async (tx) => {
			await tx.query(`DELETE FROM fonderie_mfa_backup_codes WHERE user_id = $1`, [userId]);
			if (codeHashes.length === 0) return;
			const placeholders = codeHashes.map((_, i) => `($1, $${i + 2})`).join(', ');
			await tx.query(
				`INSERT INTO fonderie_mfa_backup_codes (user_id, code_hash) VALUES ${placeholders}`,
				[userId, ...codeHashes],
			);
		});
	}

	async findUnused(userId: string): Promise<{ id: string; codeHash: string }[]> {
		const rows = await this.store.query<{ id: string; code_hash: string }>(
			`SELECT id, code_hash FROM fonderie_mfa_backup_codes
			 WHERE user_id = $1 AND used_at IS NULL`,
			[userId],
		);
		return rows.map((r) => ({ id: r.id, codeHash: r.code_hash }));
	}

	async consume(id: string): Promise<void> {
		await this.store.query(`UPDATE fonderie_mfa_backup_codes SET used_at = now() WHERE id = $1`, [
			id,
		]);
	}

	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_mfa_backup_codes WHERE user_id = $1`, [userId]);
	}
}
