import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomerRelationship } from '../types';

export interface AddRelationshipOpts {
	workspaceId: string;
	customerId: string;
	relatedId: string;
	relationship: string;
	isPrimary?: boolean;
}

export class CustomerRelationshipModel {
	constructor(private readonly store: IStoreAdapter) {}

	async list(customerId: string): Promise<ICustomerRelationship[]> {
		return this.store.query<ICustomerRelationship>(
			`SELECT id,
			        workspace_id  AS "workspaceId",
			        customer_id   AS "customerId",
			        related_id    AS "relatedId",
			        relationship,
			        is_primary    AS "isPrimary",
			        created_at    AS "createdAt"
			 FROM fonderie_customer_relationships
			 WHERE customer_id = $1
			 ORDER BY is_primary DESC, created_at ASC`,
			[customerId],
		);
	}

	async add(opts: AddRelationshipOpts): Promise<ICustomerRelationship> {
		return this.store.transaction(async (tx) => {
			if (opts.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_relationships
					 SET is_primary = false
					 WHERE customer_id = $1`,
					[opts.customerId],
				);
			}

			const [row] = await tx.query<ICustomerRelationship>(
				`INSERT INTO fonderie_customer_relationships
				   (workspace_id, customer_id, related_id, relationship, is_primary)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (customer_id, related_id) DO UPDATE
				   SET relationship = EXCLUDED.relationship,
				       is_primary   = EXCLUDED.is_primary
				 RETURNING
				   id,
				   workspace_id AS "workspaceId",
				   customer_id  AS "customerId",
				   related_id   AS "relatedId",
				   relationship,
				   is_primary   AS "isPrimary",
				   created_at   AS "createdAt"`,
				[opts.workspaceId, opts.customerId, opts.relatedId, opts.relationship, opts.isPrimary ?? false],
			);
			if (!row) throw new Error('Failed to create relationship');
			return row;
		});
	}

	async setPrimary(customerId: string, relatedId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			await tx.query(
				`UPDATE fonderie_customer_relationships SET is_primary = false WHERE customer_id = $1`,
				[customerId],
			);
			await tx.query(
				`UPDATE fonderie_customer_relationships
				 SET is_primary = true
				 WHERE customer_id = $1 AND related_id = $2`,
				[customerId, relatedId],
			);
		});
	}

	async remove(customerId: string, relatedId: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_customer_relationships
			 WHERE customer_id = $1 AND related_id = $2`,
			[customerId, relatedId],
		);
	}
}
