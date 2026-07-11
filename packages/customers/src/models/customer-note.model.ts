import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomerNote } from '../types';

const SELECT_NOTE = `
	id,
	customer_id AS "customerId",
	author_id   AS "authorId",
	body,
	created_at  AS "createdAt",
	updated_at  AS "updatedAt"
`;

export class CustomerNoteModel {
	constructor(private readonly store: IStoreAdapter) {}

	list(customerId: string): Promise<ICustomerNote[]> {
		return this.store.query<ICustomerNote>(
			`SELECT ${SELECT_NOTE}
			 FROM fonderie_customer_notes
			 WHERE customer_id = $1
			 ORDER BY created_at DESC`,
			[customerId],
		);
	}

	async create(opts: {
		customerId: string;
		authorId?: string | null;
		body: string;
	}): Promise<ICustomerNote> {
		const [row] = await this.store.query<ICustomerNote>(
			`INSERT INTO fonderie_customer_notes (id, customer_id, author_id, body)
			 VALUES (gen_random_uuid(), $1, $2, $3)
			 RETURNING ${SELECT_NOTE}`,
			[opts.customerId, opts.authorId ?? null, opts.body],
		);
		if (!row) throw new Error('Failed to create note');
		return row;
	}

	async update(noteId: string, customerId: string, body: string): Promise<ICustomerNote | null> {
		const [row] = await this.store.query<ICustomerNote>(
			`UPDATE fonderie_customer_notes
			 SET body = $1, updated_at = now()
			 WHERE id = $2 AND customer_id = $3
			 RETURNING ${SELECT_NOTE}`,
			[body, noteId, customerId],
		);
		return row ?? null;
	}

	async delete(noteId: string, customerId: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_customer_notes
			 WHERE id = $1 AND customer_id = $2`,
			[noteId, customerId],
		);
	}
}
