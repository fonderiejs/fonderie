import type { IStoreAdapter } from '@fonderie/store';

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

	/**
	 * Returns false when the label is still referenced. Labels are a SHARED
	 * table (no workspace column), so an unconditional delete would let one
	 * tenant destroy a label other tenants' emails/phones/addresses point at.
	 * Until labels are workspace-scoped, only an unreferenced label may go.
	 */
	async remove(id: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`DELETE FROM fonderie_customer_labels l
			 WHERE l.id = $1
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_emails    WHERE label_id = l.id)
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_phones    WHERE label_id = l.id)
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_addresses WHERE label_id = l.id)
			 RETURNING l.id`,
			[id],
		);
		return rows.length > 0;
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
