import type { IStoreAdapter } from '@fonderie-js/store';

import type { ISubscription, SubscriberType } from '../types';

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
		interval?: 'month' | 'year';
		status: string;
		providerCustomerId?: string;
		providerSubscriptionId?: string;
		currentPeriodStart?: Date;
		currentPeriodEnd?: Date;
		cancelAtPeriodEnd?: boolean;
		trialEndsAt?: Date | null;
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
