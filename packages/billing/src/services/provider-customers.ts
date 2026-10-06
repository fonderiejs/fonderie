import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingProvider } from '../providers/types';
import type { SubscriberType } from '../types';

// The record of every customer billing creates at the payment provider.
//
// A provider customer carries a person's email (the account that created it).
// Recording it the moment it exists — not when a subscription or a wallet row
// later points at it — means none can be lost: an abandoned checkout or a card
// set up with the wallet off still leaves a row, and erasing an account finds
// every customer created with its email (fonderie_billing_customers.created_by).

export interface ICreateRecordedCustomer {
	email: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	/** The account whose email this is; '' when there is none. */
	userId: string;
}

/** Create the customer at the provider and record it, with who it belongs to. */
export async function createRecordedCustomer(
	store: IStoreAdapter,
	provider: Pick<IBillingProvider, 'name' | 'createCustomer'>,
	opts: ICreateRecordedCustomer,
): Promise<{ customerId: string }> {
	const { customerId } = await provider.createCustomer(opts);
	await store.query(
		`INSERT INTO fonderie_billing_customers
			(provider, provider_customer_id, subscriber_type, subscriber_id, created_by)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (provider, provider_customer_id) DO NOTHING`,
		[provider.name, customerId, opts.subscriberType, opts.subscriberId, opts.userId || null],
	);
	return { customerId };
}

/**
 * The subscriber's recorded customer, or a new one created and recorded — once.
 *
 * Two checkouts (a double click, two tabs, a retry) used to both find nothing
 * and both create a customer, splitting the saved card and the invoices across
 * two provider customers that each hold the person's email. A per-subscriber
 * transaction lock serializes the find and the create, so the second caller
 * finds the first one's row. The provider call carries an idempotency key
 * derived from the subscriber, so a create whose response was lost (a crash
 * before the row committed) is replayed by the provider instead of repeated.
 * The key counts the customers already recorded, so a subscriber whose customer
 * was erased gets a genuinely new one rather than a replay of the deleted one.
 */
export async function findOrCreateRecordedCustomer(
	store: IStoreAdapter,
	provider: Pick<IBillingProvider, 'name' | 'createCustomer'>,
	opts: ICreateRecordedCustomer,
): Promise<{ customerId: string; created: boolean }> {
	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
			`fonderie_billing_customers:${provider.name}:${opts.subscriberType}:${opts.subscriberId}`,
		]);
		const existing = await latestRecordedCustomer(tx, provider.name, {
			type: opts.subscriberType,
			id: opts.subscriberId,
		});
		if (existing) return { customerId: existing, created: false };
		const [count] = await tx.query<{ n: string }>(
			`SELECT count(*)::text AS n FROM fonderie_billing_customers
			  WHERE provider = $1 AND subscriber_type = $2 AND subscriber_id = $3`,
			[provider.name, opts.subscriberType, opts.subscriberId],
		);
		const { customerId } = await provider.createCustomer({
			...opts,
			idempotencyKey: `fonderie-customer:${opts.subscriberType}:${opts.subscriberId}:${count?.n ?? '0'}`,
		});
		await tx.query(
			`INSERT INTO fonderie_billing_customers
				(provider, provider_customer_id, subscriber_type, subscriber_id, created_by)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (provider, provider_customer_id) DO NOTHING`,
			[provider.name, customerId, opts.subscriberType, opts.subscriberId, opts.userId || null],
		);
		return { customerId, created: true };
	});
}

/** The subscriber's most recently created customer that still exists, if any. */
export async function latestRecordedCustomer(
	store: IStoreAdapter,
	provider: string,
	subscriber: { type: SubscriberType; id: string },
): Promise<string | null> {
	const [row] = await store.query<{ id: string }>(
		`SELECT provider_customer_id AS id FROM fonderie_billing_customers
		  WHERE provider = $1 AND subscriber_type = $2 AND subscriber_id = $3 AND erased_at IS NULL
		  ORDER BY created_at DESC
		  LIMIT 1`,
		[provider, subscriber.type, subscriber.id],
	);
	return row?.id ?? null;
}
