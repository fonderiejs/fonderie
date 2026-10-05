import type { IStoreAdapter } from '@fonderie/store';

// The undo bin for customers (docs/INSIDER-THREAT-DESIGN.md, Phase 3). A delete
// first writes a snapshot of the customer and everything attached, in the SAME
// transaction as the delete — a refused delete (the customer is on a job)
// leaves no snapshot. A restore puts every row back with its id, in one
// transaction: all of it, or nothing.

/** How long a deleted customer stays restorable. */
export const CUSTOMER_BIN_RETENTION_DAYS = 30;

interface ISnapshot {
	customer: Record<string, unknown>;
	addresses: Record<string, unknown>[];
	addressLinks: Record<string, unknown>[];
	emails: Record<string, unknown>[];
	phones: Record<string, unknown>[];
	notes: Record<string, unknown>[];
	tags: Record<string, unknown>[];
	relationships: Record<string, unknown>[];
}

/** A deleted customer in the bin: enough to recognise it, not the whole record. */
export interface IBinnedCustomer {
	id: string;
	firstName: string | null;
	lastName: string | null;
	companyName: string | null;
	referenceCode: string | null;
	deletedBy: string | null;
	deletedAt: Date;
	purgeAt: Date;
}

/** Snapshot one customer into the bin — call inside the delete's transaction, before the delete. */
export async function binCustomer(tx: IStoreAdapter, id: string, workspaceId: string, deletedBy: string | null): Promise<void> {
	const rows = (t: string, where: string) =>
		`COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM ${t} x WHERE ${where}), '[]'::jsonb)`;
	await tx.query(
		`INSERT INTO fonderie_customer_bin (id, workspace_id, snapshot, deleted_by)
		 SELECT c.id, c.workspace_id, jsonb_build_object(
		   'customer', to_jsonb(c),
		   'addresses', ${rows('fonderie_addresses', 'x.id IN (SELECT addr_id FROM fonderie_customer_addresses WHERE customer_id = $1)')},
		   'addressLinks', ${rows('fonderie_customer_addresses', 'x.customer_id = $1')},
		   'emails', ${rows('fonderie_customer_emails', 'x.customer_id = $1')},
		   'phones', ${rows('fonderie_customer_phones', 'x.customer_id = $1')},
		   'notes', ${rows('fonderie_customer_notes', 'x.customer_id = $1')},
		   'tags', ${rows('fonderie_customer_tags', 'x.customer_id = $1')},
		   'relationships', ${rows('fonderie_customer_relationships', 'x.customer_id = $1 OR x.related_id = $1')}
		 ), $3
		 FROM fonderie_customers c WHERE c.id = $1 AND c.workspace_id = $2
		 ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, deleted_by = EXCLUDED.deleted_by, deleted_at = now()`,
		[id, workspaceId, deletedBy],
	);
}

export function listCustomerBin(store: IStoreAdapter, workspaceId: string, retentionDays = CUSTOMER_BIN_RETENTION_DAYS): Promise<IBinnedCustomer[]> {
	return store.query<IBinnedCustomer>(
		`SELECT id,
		        snapshot->'customer'->>'first_name' AS "firstName",
		        snapshot->'customer'->>'last_name' AS "lastName",
		        snapshot->'customer'->>'company_name' AS "companyName",
		        snapshot->'customer'->>'reference_code' AS "referenceCode",
		        deleted_by AS "deletedBy", deleted_at AS "deletedAt",
		        deleted_at + make_interval(days => $2) AS "purgeAt"
		 FROM fonderie_customer_bin
		 WHERE workspace_id = $1 AND deleted_at > now() - make_interval(days => $2)
		 ORDER BY deleted_at DESC`,
		[workspaceId, retentionDays],
	);
}

export type RestoreCustomerOutcome = 'restored' | 'not-in-bin' | 'conflict';

/**
 * Put a deleted customer back, with every id it had. What changed since is
 * respected: a label deleted meanwhile is dropped from its email or phone, a
 * referrer or related customer that is gone is left out. If its reference
 * code now belongs to another customer of the workspace, nothing changes and
 * the snapshot stays in the bin ('conflict').
 */
export async function restoreCustomer(store: IStoreAdapter, id: string, workspaceId: string, retentionDays = CUSTOMER_BIN_RETENTION_DAYS): Promise<RestoreCustomerOutcome> {
	try {
		return await store.transaction(async (tx) => {
			const [bin] = await tx.query<{ snapshot: ISnapshot }>(
				`DELETE FROM fonderie_customer_bin
				 WHERE id = $1 AND workspace_id = $2 AND deleted_at > now() - make_interval(days => $3)
				 RETURNING snapshot`,
				[id, workspaceId, retentionDays],
			);
			if (!bin) return 'not-in-bin';
			const s = bin.snapshot;

			// What still exists that the snapshot points at.
			const labelIds = [...s.emails, ...s.phones].map((r) => r['label_id']).filter((v): v is string => typeof v === 'string');
			const otherIds = [
				s.customer['referred_by'],
				...s.relationships.map((r) => (r['customer_id'] === id ? r['related_id'] : r['customer_id'])),
			].filter((v): v is string => typeof v === 'string');
			const [live] = await tx.query<{ labels: string[]; customers: string[] }>(
				`SELECT ARRAY(SELECT id::text FROM fonderie_customer_labels WHERE id = ANY($1::uuid[])) AS labels,
				        ARRAY(SELECT id::text FROM fonderie_customers WHERE id = ANY($2::uuid[]) AND workspace_id = $3) AS customers`,
				[labelIds, otherIds, workspaceId],
			);
			const labels = new Set(live?.labels ?? []);
			const customers = new Set(live?.customers ?? []);
			const keepLabel = (r: Record<string, unknown>) =>
				typeof r['label_id'] === 'string' && !labels.has(r['label_id']) ? { ...r, label_id: null } : r;
			const customer = typeof s.customer['referred_by'] === 'string' && !customers.has(s.customer['referred_by'])
				? { ...s.customer, referred_by: null }
				: s.customer;
			const relationships = s.relationships.filter((r) =>
				customers.has(String(r['customer_id'] === id ? r['related_id'] : r['customer_id'])),
			);

			const put = (table: string, rows: unknown) =>
				tx.query(
					`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb)`,
					[JSON.stringify(rows)],
				);
			await put('fonderie_customers', [customer]);
			await put('fonderie_addresses', s.addresses);
			await put('fonderie_customer_addresses', s.addressLinks);
			await put('fonderie_customer_emails', s.emails.map(keepLabel));
			await put('fonderie_customer_phones', s.phones.map(keepLabel));
			await put('fonderie_customer_notes', s.notes);
			await put('fonderie_customer_tags', s.tags);
			await put('fonderie_customer_relationships', relationships);
			return 'restored';
		});
	} catch (err) {
		// Another customer took the reference code meanwhile.
		if ((err as { code?: string }).code === '23505') return 'conflict';
		throw err;
	}
}

/** Gone for good — the owner's call. */
export async function purgeCustomerFromBin(store: IStoreAdapter, id: string, workspaceId: string): Promise<boolean> {
	const rows = await store.query(
		`DELETE FROM fonderie_customer_bin WHERE id = $1 AND workspace_id = $2 RETURNING id`,
		[id, workspaceId],
	);
	return rows.length > 0;
}

/** Empty the bin of snapshots past the retention — run it from the app's cron. Answers how many went. */
export async function emptyCustomerBin(store: IStoreAdapter, options: { olderThanDays?: number } = {}): Promise<number> {
	const rows = await store.query(
		`DELETE FROM fonderie_customer_bin WHERE deleted_at <= now() - make_interval(days => $1) RETURNING id`,
		[options.olderThanDays ?? CUSTOMER_BIN_RETENTION_DAYS],
	);
	return rows.length;
}
