import type { IStoreAdapter } from '@fonderie/store';

import type { BillingInterval, ISubscription, SubscriberType } from '../types';

const SELECT_SUBSCRIPTION = `
	SELECT
		id,
		subscriber_type          AS "subscriberType",
		subscriber_id            AS "subscriberId",
		plan,
		interval,
		status,
		provider_customer_id     AS "providerCustomerId",
		provider_subscription_id AS "providerSubscriptionId",
		current_period_start     AS "currentPeriodStart",
		current_period_end       AS "currentPeriodEnd",
		cancel_at_period_end     AS "cancelAtPeriodEnd",
		trial_ends_at            AS "trialEndsAt",
		created_at               AS "createdAt"
	FROM fonderie_subscriptions`;

// Resolve which subscriber owns a provider subscription id — an invoice event
// carries the provider subscription (not our subscriber identity), so this is
// how a renewal receipt / dunning finds who to notify. A provider subscription
// maps to exactly one subscriber (its identity is fixed in metadata at
// checkout), so there is normally a single matching row; the newest-row
// tiebreak only matters under the unsupported case of reassigning one provider
// subscription across subscribers.
export async function getSubscriberByProviderSubscriptionId(
	providerSubscriptionId: string,
	store: IStoreAdapter,
): Promise<{ subscriberType: SubscriberType; subscriberId: string } | null> {
	const [row] = await store.query<{ subscriberType: SubscriberType; subscriberId: string }>(
		`SELECT subscriber_type AS "subscriberType", subscriber_id AS "subscriberId"
		FROM fonderie_subscriptions WHERE provider_subscription_id = $1
		ORDER BY created_at DESC LIMIT 1`,
		[providerSubscriptionId],
	);
	return row ?? null;
}

export async function getSubscription(
	subscriberType: SubscriberType,
	subscriberId: string,
	store: IStoreAdapter,
): Promise<ISubscription | null> {
	const [row] = await store.query<ISubscription>(
		`${SELECT_SUBSCRIPTION} WHERE subscriber_type = $1 AND subscriber_id = $2`,
		[subscriberType, subscriberId],
	);
	return row ?? null;
}

export async function upsertSubscription(
	data: {
		subscriberType: SubscriberType;
		subscriberId: string;
		plan: string;
		interval?: BillingInterval;
		status: string;
		providerCustomerId?: string;
		providerSubscriptionId?: string;
		// Date from the webhook (normalized) or an ISO string when carried forward
		// from a stored ISubscription row — Postgres accepts either for timestamptz.
		currentPeriodStart?: Date | string;
		currentPeriodEnd?: Date | string;
		cancelAtPeriodEnd?: boolean;
		trialEndsAt?: Date | string | null;
	},
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_subscriptions
			(subscriber_type, subscriber_id, plan, interval, status,
			 provider_customer_id, provider_subscription_id,
			 current_period_start, current_period_end,
			 cancel_at_period_end, trial_ends_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (subscriber_type, subscriber_id) DO UPDATE SET
			 plan                     = $3,
			 interval                 = $4,
			 status                   = $5,
			 provider_customer_id     = COALESCE($6, fonderie_subscriptions.provider_customer_id),
			 provider_subscription_id = COALESCE($7, fonderie_subscriptions.provider_subscription_id),
			 current_period_start     = $8,
			 current_period_end       = $9,
			 cancel_at_period_end     = $10,
			 trial_ends_at            = $11`,
		[
			data.subscriberType,
			data.subscriberId,
			data.plan,
			data.interval ?? 'month',
			data.status,
			data.providerCustomerId ?? null,
			data.providerSubscriptionId ?? null,
			data.currentPeriodStart ?? null,
			data.currentPeriodEnd ?? null,
			data.cancelAtPeriodEnd ?? false,
			data.trialEndsAt ?? null,
		],
	);
}
