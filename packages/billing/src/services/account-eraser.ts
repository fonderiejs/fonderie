import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingProvider } from '../providers/types';
import type { SubscriberType } from '../types';
import { alreadyGone } from './subscriber-lifecycle';

// What billing erases when an account is purged (docs/ACCOUNT-DELETION-DESIGN.md
// Phase 4, D7, D8). Auth runs every brick's eraser IN-PROCESS before the
// account row goes; a throw keeps the account archived and the purge retries.
// Billing takes no dependency on @fonderie/auth, so the shapes are declared here.
//
// What billing holds about a person is mostly AT THE PROVIDER: the customer
// record carries their email and saved cards. Locally, subscriptions, the
// wallet ledger and invoices are financial records accounting law keeps; they
// are keyed by an id that no longer resolves to a person once the account row
// is gone, so they stay as they are (pseudonymized, D8).
//
// Which provider customers carry this person's email:
//   • their OWN (user subscriber) — deleted at the provider;
//   • a WORKSPACE's that goes with the account (they own it and no one else is
//     in it — the workspaces eraser deletes it) — deleted too: nobody is left
//     to pay for or use what it bills;
//   • a WORKSPACE's that survives them (someone else's team, or one handed
//     over) but was created with their email — kept, because the team still
//     pays through it, and their email replaced with the workspace's business
//     email (or removed when it has none), only if it is still theirs.
// Found three ways: the customer record (fonderie_billing_customers.created_by,
// every customer created since it exists), and — for older customers — the
// subscription and wallet rows of the person and of the workspaces they own or
// belong to. That last way reads the workspaces tables, so list billing's
// eraser BEFORE the workspaces eraser.

/** Who is being erased — the same shape auth hands every brick's eraser. */
export interface IBillingErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IBillingAccountEraser {
	name: 'billing';
	erase(subject: IBillingErasureSubject): Promise<{ erased: number; kept?: string }>;
}

export interface IBillingAccountEraserOptions {
	provider: Pick<IBillingProvider, 'name'> &
		Partial<Pick<IBillingProvider, 'deleteCustomer' | 'replaceCustomerEmail'>>;
}

interface ICandidate {
	customerId: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	createdBy: string | null;
}

interface IWorkspaceFact {
	id: string;
	email: string | null;
	/** The workspace goes with the account: owned by the person, no one else in it. */
	goes: boolean;
}

/**
 * Billing's account eraser: delete the provider customers that carry the
 * person's email and go with them, take their email off the ones that survive
 * them. Idempotent (a customer already gone is success; an email already
 * replaced is left alone), and throws only on a real provider failure.
 */
export function accountEraser(
	store: IStoreAdapter,
	opts: IBillingAccountEraserOptions,
): IBillingAccountEraser {
	const { provider } = opts;
	return {
		name: 'billing',
		async erase(subject) {
			const userId = subject.userId;
			const related = await relatedWorkspaces(store, userId);
			const candidates = await store.query<ICandidate>(
				`WITH c AS (
				   SELECT provider_customer_id AS id, subscriber_type, subscriber_id, created_by
				     FROM fonderie_billing_customers
				    WHERE erased_at IS NULL
				      AND (created_by = $1
				           OR (subscriber_type = 'user' AND subscriber_id = $1)
				           OR (subscriber_type = 'workspace' AND subscriber_id = ANY($2::uuid[])))
				   UNION
				   SELECT provider_customer_id, subscriber_type, subscriber_id, NULL::uuid
				     FROM fonderie_subscriptions
				    WHERE provider_customer_id IS NOT NULL
				      AND ((subscriber_type = 'user' AND subscriber_id = $1)
				           OR (subscriber_type = 'workspace' AND subscriber_id = ANY($2::uuid[])))
				   UNION
				   SELECT provider_customer_id, subscriber_type, subscriber_id, NULL::uuid
				     FROM fonderie_wallet_customers
				    WHERE (subscriber_type = 'user' AND subscriber_id = $1)
				       OR (subscriber_type = 'workspace' AND subscriber_id = ANY($2::uuid[]))
				 )
				 SELECT DISTINCT ON (c.id) c.id AS "customerId", c.subscriber_type AS "subscriberType",
				        c.subscriber_id AS "subscriberId", c.created_by AS "createdBy"
				   FROM c
				  WHERE NOT EXISTS (
				    SELECT 1 FROM fonderie_billing_customers r
				     WHERE r.provider_customer_id = c.id AND r.erased_at IS NOT NULL)
				  ORDER BY c.id, c.created_by NULLS LAST`,
				[userId, [...related.keys()]],
			);

			// Workspaces met only through the customer record (the person is no
			// longer in them, or they are gone): look up whether they still exist.
			const unknown = [
				...new Set(
					candidates
						.filter((c) => c.subscriberType === 'workspace' && !related.has(c.subscriberId))
						.map((c) => c.subscriberId),
				),
			];
			const others = await existingWorkspaces(store, unknown);

			const toDelete = new Set<string>();
			const toRelabel = new Map<string, string | null>();
			for (const c of candidates) {
				if (c.subscriberType === 'user') {
					// Their own; another user's customer only reaches here through
					// created_by, which billing never writes that way — keep it safe.
					if (c.subscriberId === userId) toDelete.add(c.customerId);
					else toRelabel.set(c.customerId, null);
					continue;
				}
				const ws = related.get(c.subscriberId) ?? others.get(c.subscriberId);
				if (ws === undefined) {
					// The workspace no longer exists: nobody is left to pay through
					// it. When nothing can say (no workspaces tables), keep it safe.
					if (others === UNKNOWN) toRelabel.set(c.customerId, null);
					else toDelete.add(c.customerId);
				} else if (ws.goes) {
					toDelete.add(c.customerId);
				} else {
					toRelabel.set(c.customerId, ws.email);
				}
			}
			// Never delete what a surviving team still pays through.
			for (const id of toRelabel.keys()) toDelete.delete(id);

			let erased = 0;
			const kept: string[] = [
				'Subscriptions, the wallet ledger and invoices are kept as financial records (accounting law), keyed by an id that no longer resolves to a person; the payment provider keeps its own invoices.',
			];

			if (toDelete.size > 0) {
				if (typeof provider.deleteCustomer !== 'function') {
					kept.push(
						`${toDelete.size} customer record(s) at the payment provider still carry the person's email: the provider cannot delete customers.`,
					);
				} else {
					for (const id of toDelete) {
						try {
							await provider.deleteCustomer(id);
						} catch (err) {
							if (!alreadyGone(err)) throw err;
						}
						const c = candidates.find((x) => x.customerId === id) as ICandidate;
						// Recorded at once, so a retry after a later failure skips it.
						await store.query(
							`INSERT INTO fonderie_billing_customers
								(provider, provider_customer_id, subscriber_type, subscriber_id, created_by, erased_at)
							 VALUES ($1, $2, $3, $4, $5, now())
							 ON CONFLICT (provider, provider_customer_id) DO UPDATE SET erased_at = now()`,
							[provider.name, id, c.subscriberType, c.subscriberId, c.createdBy],
						);
						erased++;
					}
				}
			}

			if (toRelabel.size > 0) {
				const email = subject.email;
				if (!email) {
					// No email on the account: nothing of theirs to take off.
				} else if (typeof provider.replaceCustomerEmail !== 'function') {
					kept.push(
						`${toRelabel.size} team customer record(s) at the payment provider are kept for the workspace that survives; the provider cannot change a customer's email, so it may still be the person's.`,
					);
				} else {
					let relabeled = 0;
					for (const [id, replacement] of toRelabel) {
						const same = replacement !== null && replacement.toLowerCase() === email.toLowerCase();
						const changed = await provider.replaceCustomerEmail({
							customerId: id,
							email,
							replacement: same ? null : replacement,
						});
						if (changed) relabeled++;
					}
					erased += relabeled;
					kept.push(
						`${toRelabel.size} team customer record(s) at the payment provider are kept: the workspace survives and still pays through them; the person's email on them was replaced by the workspace's business email, or removed.`,
					);
				}
			}

			return { erased, kept: kept.join(' ') };
		},
	};
}

const UNKNOWN = new Map<string, IWorkspaceFact>();

// The workspaces the person owns or belongs to, and whether each goes with
// the account: owned by them and no other LIVE member — not removed, not
// suspended, an account that exists and is not itself awaiting deletion.
// This MUST be the workspaces eraser's rule (@fonderie/workspaces
// account-deletion.ts, OTHER_LIVE_MEMBER): if billing kept a customer for a
// workspace the workspaces eraser deletes, its subscription would live on with
// no workspace; the reverse would cancel a surviving team's plan. Reads the
// workspaces brick's tables (data, not code — the same cross-brick read as
// services/membership.ts). Without that brick, there are none.
async function relatedWorkspaces(store: IStoreAdapter, userId: string): Promise<Map<string, IWorkspaceFact>> {
	let rows: IWorkspaceFact[];
	try {
		rows = await store.query<IWorkspaceFact>(
			`SELECT w.id, w.email,
			        (w.owner_id = $1 AND NOT EXISTS (
			           SELECT 1 FROM fonderie_role_user_workspaces m
			            JOIN fonderie_users u ON u.id = m.user_id AND u.deleted_at IS NULL
			            WHERE m.workspace_id = w.id AND m.user_id <> $1
			              AND m.removed = false AND m.suspended = false
			        )) AS goes
			   FROM fonderie_workspaces w
			  WHERE w.owner_id = $1
			     OR w.id IN (SELECT workspace_id FROM fonderie_role_user_workspaces WHERE user_id = $1)`,
			[userId],
		);
	} catch {
		return new Map();
	}
	return new Map(rows.map((r) => [r.id, r]));
}

// Workspaces that still exist, among those ids — each survives the person
// (they neither own it nor belong to it). UNKNOWN when nothing can say.
async function existingWorkspaces(store: IStoreAdapter, ids: string[]): Promise<Map<string, IWorkspaceFact>> {
	if (ids.length === 0) return new Map();
	try {
		const rows = await store.query<{ id: string; email: string | null }>(
			`SELECT id, email FROM fonderie_workspaces WHERE id = ANY($1::uuid[])`,
			[ids],
		);
		return new Map(rows.map((r) => [r.id, { id: r.id, email: r.email, goes: false }]));
	} catch {
		return UNKNOWN;
	}
}
