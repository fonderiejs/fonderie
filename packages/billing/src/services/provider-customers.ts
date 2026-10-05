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
