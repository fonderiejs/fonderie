import type { IStoreAdapter } from '@fonderie/store';

// What customers erases when an account is purged (docs/ACCOUNT-DELETION-
// DESIGN.md, Phase 4). Auth runs every brick's eraser in-process before the
// account row goes; a throw keeps the account archived and the purge retries.
// Customers takes no dependency on @fonderie/auth, so the shapes are declared
// here.
//
// Customer records are the BUSINESS's data — a workspace's clients, its notes
// about them — not the deleted person's, so they stay. What points at the
// person is who did the work: `fonderie_customers.created_by` and
// `fonderie_customer_notes.author_id`. Both are cleared (pseudonymized): the
// record and the note stay, by nobody.

/** Who is being erased — the same shape auth hands every brick's eraser. */
export interface ICustomersErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface ICustomersAccountEraser {
	name: 'customers';
	erase(subject: ICustomersErasureSubject): Promise<{ erased: number; kept?: string }>;
}

const KEPT =
	'Customer records, their contact details and notes belong to the business (the workspace) and are kept; the person is no longer named as the one who created a customer or wrote a note. A customer whose own contact details are the person\'s is the business\'s record of them, erased by the business.';

/**
 * Customers' account eraser: clear the person's id from the customers they
 * created and the notes they wrote. One statement (both or neither), and
 * idempotent — a second run finds nothing to clear.
 */
export function accountEraser(store: IStoreAdapter): ICustomersAccountEraser {
	return {
		name: 'customers',
		async erase(subject) {
			const [row] = await store.query<{ customers: number; notes: number }>(
				`WITH c AS (
				   UPDATE fonderie_customers SET created_by = NULL WHERE created_by = $1 RETURNING 1
				 ), n AS (
				   UPDATE fonderie_customer_notes SET author_id = NULL WHERE author_id = $1 RETURNING 1
				 )
				 SELECT (SELECT count(*) FROM c)::int AS customers, (SELECT count(*) FROM n)::int AS notes`,
				[subject.userId],
			);
			return { erased: (row?.customers ?? 0) + (row?.notes ?? 0), kept: KEPT };
		},
	};
}
