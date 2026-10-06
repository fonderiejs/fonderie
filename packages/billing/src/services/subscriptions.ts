import { encodeKeysetCursor } from '@fonderie/core';
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
		created_at               AS "createdAt"`;

// The single-row reads below append their own FROM; the list appends an extra
// column first, so the table name is not baked into the column list.
const FROM_SUBSCRIPTIONS = ' FROM fonderie_subscriptions';

// Statuses under which a subscription still exists at the provider and can
// bill or be resumed. A row in one of these with a provider subscription id is
// a real, live subscription: nothing but its own webhooks may replace it.
export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];

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
	const end =
		sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd);
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
		`${SELECT_SUBSCRIPTION}${FROM_SUBSCRIPTIONS} WHERE subscriber_type = $1 AND subscriber_id = $2`,
		[subscriberType, subscriberId],
	);
	return row ?? null;
}

export interface ISubscriptionPage {
	subscriptions: ISubscription[];
	nextCursor: string | null;
}

// One page of subscribers, newest first. Keyset-paginated on (created_at, id),
// the same cursor contract as the wallet ledger. The +1 over-fetch that detects
// a next page lives here so no outer clamp can shave it off, and nextCursor is
// built from created_at::text so same-microsecond rows cannot be skipped.
export async function listSubscriptions(
	query: { limit?: number; cursor?: { createdAt: string; id: string } | null },
	store: IStoreAdapter,
): Promise<ISubscriptionPage> {
	const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
	const params: unknown[] = [];
	const where: string[] = [];

	if (query.cursor) {
		params.push(query.cursor.createdAt, query.cursor.id);
		where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
	}

	params.push(limit + 1);
	const rows = await store.query<ISubscription & { createdAtRaw?: string }>(
		// created_at::text alongside the timestamp: the cursor needs full
		// microsecond precision, which a Date round-trip drops.
		`${SELECT_SUBSCRIPTION}, created_at::text AS "createdAtRaw"${FROM_SUBSCRIPTIONS}
		 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 ORDER BY created_at DESC, id DESC
		 LIMIT $${params.length}`,
		params,
	);

	const page = rows.slice(0, limit);
	const last = page[page.length - 1];
	return {
		subscriptions: page,
		nextCursor:
			rows.length > limit && last
				? encodeKeysetCursor(last.createdAtRaw ?? String(last.createdAt), last.id)
				: null,
	};
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
		// The provider event's own timestamp (Stripe `event.created`). Set only by
		// the webhook path; non-webhook writers (checkout / cancel / reactivate)
		// leave it undefined. Guards the UPDATE against at-least-once, out-of-order
		// redelivery — a stale event is a no-op instead of resurrecting a
		// canceled/downgraded row.
		providerEventAt?: Date | string | null;
		// Set by the optimistic non-webhook writers (cancel-at-period-end,
		// reactivate) that carry no providerEventAt. Their null token would
		// otherwise make the ordering guard always apply — so a write still
		// in-flight when a TERMINAL customer.subscription.deleted webhook lands
		// would resurrect the canceled row to active/paid, with no later webhook
		// to correct it (deleted is terminal). When true, the UPDATE additionally
		// refuses to touch a row a webhook has already canceled.
		guardNotWebhookCanceled?: boolean;
		// Checkout's in-place upgrade read the row, then spent a provider round
		// trip. Write only if the row still holds THIS live provider subscription:
		// a cancel that landed meanwhile (a terminal deleted webhook) must not be
		// overwritten with the upgrade's 'active'.
		guardLiveSubscriptionId?: string;
		// Checkout's new-subscription marker ('incomplete', no provider id). Write
		// only if the row is not a live subscription: a paid-session webhook that
		// landed meanwhile must not be orphaned by a null provider id.
		guardNotLive?: boolean;
	},
	store: IStoreAdapter,
): Promise<boolean> {
	// Returns whether the row was written. A stale/out-of-order webhook fails the
	// ordering guard below, updates nothing, and returns false — so the caller can
	// skip lifecycle events + customer notices that would otherwise act on the
	// stale state (the event-bus twin of the DB resurrection this guards against).
	// An optimistic write with guardNotWebhookCanceled likewise returns false when
	// a webhook already terminated the subscription, so the caller can report the
	// truthful (canceled) state instead of a phantom reactivation.
	const params: unknown[] = [
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
		data.providerEventAt ?? null,
	];
	let terminalGuard = data.guardNotWebhookCanceled
		? `\n\t\t    AND NOT (fonderie_subscriptions.status = 'canceled' AND fonderie_subscriptions.provider_event_at IS NOT NULL)`
		: '';
	if (data.guardLiveSubscriptionId !== undefined || data.guardNotLive) {
		params.push(LIVE_SUBSCRIPTION_STATUSES);
		const live = `fonderie_subscriptions.status = ANY($${params.length}::text[])`;
		if (data.guardNotLive) {
			terminalGuard += `\n\t\t    AND NOT (fonderie_subscriptions.provider_subscription_id IS NOT NULL AND ${live})`;
		}
		if (data.guardLiveSubscriptionId !== undefined) {
			params.push(data.guardLiveSubscriptionId);
			terminalGuard += `\n\t\t    AND ${live} AND fonderie_subscriptions.provider_subscription_id = $${params.length}`;
		}
	}
	const rows = await store.query<{ applied: number }>(
		`INSERT INTO fonderie_subscriptions
			(subscriber_type, subscriber_id, plan, interval, status,
			 provider_customer_id, provider_subscription_id,
			 current_period_start, current_period_end,
			 cancel_at_period_end, trial_ends_at, provider_event_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
			 trial_ends_at            = $11,
			 -- COALESCE (not ASSIGN): keep the stored ordering token when a
			 -- non-webhook write ($12 null) applies, so a later stale webhook still
			 -- sees the last-applied event time and is rejected.
			 provider_event_at        = COALESCE($12, fonderie_subscriptions.provider_event_at)
		 WHERE (fonderie_subscriptions.provider_event_at IS NULL
		    OR $12::timestamptz IS NULL
		    OR $12::timestamptz >= fonderie_subscriptions.provider_event_at)${terminalGuard}
		 RETURNING 1 AS applied`,
		params,
	);
	return rows.length > 0;
}

// The webhook's write: the upsert plus the status it REPLACED, taken under the
// same lock. The customer notices fire on the transition into canceled /
// past_due, so the prior status must be the one this write overwrote — read in
// a separate statement, two concurrent deliveries of one event both saw the old
// status and both sent the email. A per-subscriber transaction lock (taken
// before the row exists, so a first-ever insert is covered too) makes the
// second delivery see the first one's result.
export async function upsertSubscriptionWithPrior(
	data: Parameters<typeof upsertSubscription>[0],
	store: IStoreAdapter,
): Promise<{ applied: boolean; priorStatus: string | null }> {
	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
			`fonderie_subscriptions:${data.subscriberType}:${data.subscriberId}`,
		]);
		const [prior] = await tx.query<{ status: string }>(
			`SELECT status FROM fonderie_subscriptions
			 WHERE subscriber_type = $1 AND subscriber_id = $2
			 FOR UPDATE`,
			[data.subscriberType, data.subscriberId],
		);
		const applied = await upsertSubscription(data, tx);
		return { applied, priorStatus: prior?.status ?? null };
	});
}

// Durably record that a subscriber has consumed a free trial. Idempotent — the
// subscription webhook calls it every time a subscription carries a trial, so it
// must survive re-delivery and the cancel → resubscribe cycle. This is the memory
// the (overwritten) subscription row cannot keep.
export async function markTrialConsumed(
	subscriberType: SubscriberType,
	subscriberId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_subscription_trials (subscriber_type, subscriber_id)
		 VALUES ($1, $2)
		 ON CONFLICT (subscriber_type, subscriber_id) DO NOTHING`,
		[subscriberType, subscriberId],
	);
}

// Whether a subscriber has already consumed a free trial. Checkout consults this
// before applying a plan's trialDays, so a returning subscriber can't farm a new
// trial on every re-subscribe.
export async function hasConsumedTrial(
	subscriberType: SubscriberType,
	subscriberId: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ one: number }>(
		`SELECT 1 AS one FROM fonderie_subscription_trials
		 WHERE subscriber_type = $1 AND subscriber_id = $2`,
		[subscriberType, subscriberId],
	);
	return rows.length > 0;
}

// Whether ANY workspace owned by the same owner as `workspaceId` has consumed a
// free trial (the workspace itself included). Backs `trialScope: 'owner'`: with
// per-workspace billing, the per-subscriber ledger alone lets one person farm a
// trial per new workspace they create. Needs the workspaces brick's table; a
// workspace it cannot find matches nothing (the per-subscriber check still runs).
export async function hasOwnerConsumedTrial(
	workspaceId: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ one: number }>(
		`SELECT 1 AS one
		   FROM fonderie_subscription_trials t
		   JOIN fonderie_workspaces w  ON w.id = t.subscriber_id
		   JOIN fonderie_workspaces me ON me.owner_id = w.owner_id
		  WHERE t.subscriber_type = 'workspace' AND me.id = $1
		  LIMIT 1`,
		[workspaceId],
	);
	return rows.length > 0;
}
