import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomerEmail } from '../types';

const SELECT_EMAIL = `
	id,
	customer_id AS "customerId",
	email,
	label,
	is_primary  AS "isPrimary",
	created_at  AS "createdAt"
`;

export class CustomerEmailModel {
	constructor(private readonly store: IStoreAdapter) {}

	list(customerId: string): Promise<ICustomerEmail[]> {
		return this.store.query<ICustomerEmail>(
			`SELECT ${SELECT_EMAIL}
			 FROM fonderie_customer_emails
			 WHERE customer_id = $1
			 ORDER BY is_primary DESC, created_at ASC`,
			[customerId],
		);
	}

	async add(opts: {
		customerId: string;
		email: string;
		label?: string;
		isPrimary?: boolean;
	}): Promise<ICustomerEmail> {
		const [row] = await this.store.query<ICustomerEmail>(
			`INSERT INTO fonderie_customer_emails (id, customer_id, email, label, is_primary)
			 VALUES (gen_random_uuid(), $1, $2, $3, $4)
			 RETURNING ${SELECT_EMAIL}`,
			[opts.customerId, opts.email, opts.label ?? 'work', opts.isPrimary ?? false],
		);
		if (!row) throw new Error('Failed to add customer email');
		return row;
	}

	async setPrimary(emailId: string, customerId: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customer_emails
			 SET is_primary = (id = $1)
			 WHERE customer_id = $2`,
			[emailId, customerId],
		);
	}

	async remove(emailId: string, customerId: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_customer_emails
			 WHERE id = $1 AND customer_id = $2`,
			[emailId, customerId],
		);
	}
}
