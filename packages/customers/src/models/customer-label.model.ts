import type { IStoreAdapter } from '@fonderie/store';

import type { CustomerLabelType, ICustomerLabel } from '../types';

const SELECT = `id, type, value, created_at AS "createdAt"`;

export class CustomerLabelModel {
	constructor(private readonly store: IStoreAdapter) {}

	/**
	 * List the labels a workspace may use: the shared/system defaults
	 * (workspace_id IS NULL) plus its OWN private labels. Never another
	 * workspace's — so listing can't enumerate other tenants' custom
	 * vocabulary.
	 */
	list(type: CustomerLabelType, workspaceId: string): Promise<ICustomerLabel[]> {
		return this.store.query<ICustomerLabel>(
			`SELECT ${SELECT}
			 FROM fonderie_customer_labels
			 WHERE type = $1 AND (workspace_id IS NULL OR workspace_id = $2)
			 ORDER BY value ASC`,
			[type, workspaceId],
		);
	}

	/**
	 * Delete a label. Only a label OWNED BY this workspace and UNREFERENCED can
	 * go: shared defaults (workspace_id IS NULL) and other workspaces' labels
	 * are untouchable, and an in-use label (still pointed at by an email/phone/
	 * address) is refused so it can't be destroyed out from under a record.
	 * Returns false when nothing was deleted.
	 */
	async remove(id: string, workspaceId: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`DELETE FROM fonderie_customer_labels l
			 WHERE l.id = $1
			   AND l.workspace_id = $2
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_emails    WHERE label_id = l.id)
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_phones    WHERE label_id = l.id)
			   AND NOT EXISTS (SELECT 1 FROM fonderie_customer_addresses WHERE label_id = l.id)
			 RETURNING l.id`,
			[id, workspaceId],
		);
		return rows.length > 0;
	}

	/**
	 * Resolve a (type, value) to a label id for this workspace: reuse a shared
	 * default when one exists (so common labels like 'work' stay canonical),
	 * otherwise create/reuse a label PRIVATE to this workspace.
	 */
	async findOrCreate(
		type: CustomerLabelType,
		raw: string,
		workspaceId: string,
	): Promise<ICustomerLabel> {
		const value = raw.trim().toLowerCase();

		// Prefer a shared default — keeps the seeded vocabulary canonical and
		// avoids minting a per-workspace duplicate of 'work'/'personal'/etc.
		const [shared] = await this.store.query<ICustomerLabel>(
			`SELECT ${SELECT} FROM fonderie_customer_labels
			 WHERE type = $1 AND value = $2 AND workspace_id IS NULL
			 LIMIT 1`,
			[type, value],
		);
		if (shared) return shared;

		// Otherwise a workspace-private label (unique per type+value+workspace).
		const [row] = await this.store.query<ICustomerLabel>(
			`INSERT INTO fonderie_customer_labels (type, value, workspace_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (type, value, workspace_id) WHERE workspace_id IS NOT NULL
			 DO UPDATE SET value = EXCLUDED.value
			 RETURNING ${SELECT}`,
			[type, value, workspaceId],
		);
		if (!row) throw new Error('Failed to find or create label');
		return row;
	}
}
