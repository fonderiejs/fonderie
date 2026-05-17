import type { IStoreAdapter } from '@fonderie-js/store';

export class CustomerTagModel {
	constructor(private readonly store: IStoreAdapter) {}

	async list(customerId: string): Promise<string[]> {
		const rows = await this.store.query<{ tag: string }>(
			`SELECT tag FROM fonderie_customer_tags
			 WHERE customer_id = $1
			 ORDER BY tag ASC`,
			[customerId],
		);
		return rows.map((r) => r.tag);
	}

	async add(customerId: string, tag: string): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_customer_tags (customer_id, tag)
			 VALUES ($1, $2)
			 ON CONFLICT (customer_id, tag) DO NOTHING`,
			[customerId, tag],
		);
	}

	async remove(customerId: string, tag: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_customer_tags
			 WHERE customer_id = $1 AND tag = $2`,
			[customerId, tag],
		);
	}
}
