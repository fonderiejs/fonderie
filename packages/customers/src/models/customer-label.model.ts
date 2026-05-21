import type { IStoreAdapter } from '@fonderie-js/store';

import type { CustomerLabelType, ICustomerLabel } from '../types';

export class CustomerLabelModel {
	constructor(private readonly store: IStoreAdapter) {}

	list(type: CustomerLabelType): Promise<ICustomerLabel[]> {
		return this.store.query<ICustomerLabel>(
			`SELECT id, type, value, created_at AS "createdAt"
			 FROM fonderie_customer_labels
			 WHERE type = $1
			 ORDER BY value ASC`,
			[type],
		);
	}

	remove(id: string): Promise<void> {
		return this.store.query(
			`DELETE FROM fonderie_customer_labels WHERE id = $1`,
			[id],
		).then(() => undefined);
	}

	async findOrCreate(type: CustomerLabelType, raw: string): Promise<ICustomerLabel> {
		const value = raw.trim().toLowerCase();
		const [row] = await this.store.query<ICustomerLabel>(
			`INSERT INTO fonderie_customer_labels (type, value)
			 VALUES ($1, $2)
			 ON CONFLICT (type, value) DO UPDATE SET value = EXCLUDED.value
			 RETURNING id, type, value, created_at AS "createdAt"`,
			[type, value],
		);
		if (!row) throw new Error('Failed to find or create label');
		return row;
	}
}
