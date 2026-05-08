import type { IStoreAdapter } from '@fonderie-js/store';

import type { ISubscription } from '../types';

export async function getSubscription(
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<ISubscription | null> {
	const [row] = await store.query<ISubscription>(
		`SELECT
			id,
			workspace_id              AS "workspaceId",
			plan,
			interval,
			status,
			provider_customer_id      AS "providerCustomerId",
			provider_subscription_id  AS "providerSubscriptionId",
			current_period_start      AS "currentPeriodStart",
			current_period_end        AS "currentPeriodEnd",
			cancel_at_period_end      AS "cancelAtPeriodEnd",
			trial_ends_at             AS "trialEndsAt",
			created_at                AS "createdAt"
		FROM fonderie_subscriptions
		WHERE workspace_id = $1`,
		[workspaceId],
	);

	return row ?? null;
}

export async function upsertSubscription(
	data: {
		workspaceId:             string
		plan:                    string
		interval?:               'month' | 'year'
		status:                  string
		providerCustomerId?:     string
		providerSubscriptionId?: string
		currentPeriodStart?:     Date
		currentPeriodEnd?:       Date
		cancelAtPeriodEnd?:      boolean
		trialEndsAt?:            Date | null
	},
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_subscriptions
			(workspace_id, plan, interval, status,
			 provider_customer_id, provider_subscription_id,
			 current_period_start, current_period_end,
			 cancel_at_period_end, trial_ends_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (workspace_id) DO UPDATE SET
			 plan                     = $2,
			 interval                 = $3,
			 status                   = $4,
			 provider_customer_id     = COALESCE($5, fonderie_subscriptions.provider_customer_id),
			 provider_subscription_id = COALESCE($6, fonderie_subscriptions.provider_subscription_id),
			 current_period_start     = $7,
			 current_period_end       = $8,
			 cancel_at_period_end     = $9,
			 trial_ends_at            = $10`,
		 [
			 data.workspaceId,
			 data.plan,
			 data.interval              ?? 'month',
			 data.status,
			 data.providerCustomerId    ?? null,
			 data.providerSubscriptionId ?? null,
			 data.currentPeriodStart    ?? null,
			 data.currentPeriodEnd      ?? null,
			 data.cancelAtPeriodEnd     ?? false,
			 data.trialEndsAt           ?? null,
		 ],
	);
}
