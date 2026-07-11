import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomerEmail } from '../types';

const SELECT_EMAIL = `
	id,
	customer_id AS "customerId",
	email,
	label_id    AS "labelId",
	(SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
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
		labelId: string;
		isPrimary?: boolean;
	}): Promise<ICustomerEmail> {
		return this.store.transaction(async (tx) => {
			if (opts.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_emails SET is_primary = false WHERE customer_id = $1`,
					[opts.customerId],
				);
			}
			const [row] = await tx.query<ICustomerEmail>(
				`INSERT INTO fonderie_customer_emails (id, customer_id, email, label_id, is_primary)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4)
				 RETURNING ${SELECT_EMAIL}`,
				[opts.customerId, opts.email, opts.labelId, opts.isPrimary ?? false],
			);
			if (!row) throw new Error('Failed to add customer email');
			return row;
		});
	}

	async updateLabel(emailId: string, customerId: string, labelId: string): Promise<ICustomerEmail> {
		const [row] = await this.store.query<ICustomerEmail>(
			`UPDATE fonderie_customer_emails
			 SET label_id = $3
			 WHERE id = $1 AND customer_id = $2
			 RETURNING ${SELECT_EMAIL}`,
			[emailId, customerId, labelId],
		);
		if (!row) throw Object.assign(new Error('Email not found'), { code: 'NOT_FOUND' });
		return row;
	}

	async setPrimary(emailId: string, customerId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			await tx.query(
				`UPDATE fonderie_customer_emails SET is_primary = false WHERE customer_id = $1`,
				[customerId],
			);
			await tx.query(
				`UPDATE fonderie_customer_emails SET is_primary = true WHERE id = $1 AND customer_id = $2`,
				[emailId, customerId],
			);
		});
	}

	async remove(emailId: string, customerId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			const [deleted] = await tx.query<{ isPrimary: boolean }>(
				`DELETE FROM fonderie_customer_emails
				 WHERE id = $1 AND customer_id = $2
				 RETURNING is_primary AS "isPrimary"`,
				[emailId, customerId],
			);
			if (deleted?.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_emails
					 SET is_primary = true
					 WHERE id = (
					   SELECT id FROM fonderie_customer_emails
					   WHERE customer_id = $1
					   ORDER BY created_at ASC
					   LIMIT 1
					 )`,
					[customerId],
				);
			}
		});
	}
}
