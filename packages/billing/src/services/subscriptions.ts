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

// Dunning grace: a past_due subscriber still counts as having access for
// `graceDays` beyond the (failed) renewal date, so a transient card failure
// doesn't instantly lock out a paying customer while the provider retries.
export function isWithinDunningGrace(
	sub: { status: string; currentPeriodEnd: string | Date | null },
	graceDays: number | undefined,
	now: Date = new Date(),
): boolean {
	if (!graceDays || graceDays <= 0) return false;
	if (sub.status !== 'past_due' || !sub.currentPeriodEnd) return false;
	const end = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd);
	if (Number.isNaN(end.getTime())) return false;
	return now.getTime() <= end.getTime() + graceDays * 86_400_000;
}

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
			 -- ASSIGN (not COALESCE): a fresh checkout / resubscribe passes null to
			 -- clear a prior dead subscription id; every other caller passes the
			 -- current id, so this never wipes a live one.
			 provider_subscription_id = $7,
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
