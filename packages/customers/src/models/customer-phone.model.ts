import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomerPhone } from '../types';

const SELECT_PHONE = `
	id,
	customer_id AS "customerId",
	phone,
	label,
	is_primary  AS "isPrimary",
	created_at  AS "createdAt"
`;

export class CustomerPhoneModel {
	constructor(private readonly store: IStoreAdapter) {}

	list(customerId: string): Promise<ICustomerPhone[]> {
		return this.store.query<ICustomerPhone>(
			`SELECT ${SELECT_PHONE}
			 FROM fonderie_customer_phones
			 WHERE customer_id = $1
			 ORDER BY is_primary DESC, created_at ASC`,
			[customerId],
		);
	}

	async add(opts: {
		customerId: string;
		phone: string;
		label?: string;
		isPrimary?: boolean;
	}): Promise<ICustomerPhone> {
		return this.store.transaction(async (tx) => {
			if (opts.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_phones SET is_primary = false WHERE customer_id = $1`,
					[opts.customerId],
				);
			}
			const [row] = await tx.query<ICustomerPhone>(
				`INSERT INTO fonderie_customer_phones (id, customer_id, phone, label, is_primary)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4)
				 RETURNING ${SELECT_PHONE}`,
				[opts.customerId, opts.phone, opts.label ?? 'mobile', opts.isPrimary ?? false],
			);
			if (!row) throw new Error('Failed to add customer phone');
			return row;
		});
	}

	async setPrimary(phoneId: string, customerId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			await tx.query(
				`UPDATE fonderie_customer_phones SET is_primary = false WHERE customer_id = $1`,
				[customerId],
			);
			await tx.query(
				`UPDATE fonderie_customer_phones SET is_primary = true WHERE id = $1 AND customer_id = $2`,
				[phoneId, customerId],
			);
		});
	}

	async remove(phoneId: string, customerId: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_customer_phones
			 WHERE id = $1 AND customer_id = $2`,
			[phoneId, customerId],
		);
	}
}
