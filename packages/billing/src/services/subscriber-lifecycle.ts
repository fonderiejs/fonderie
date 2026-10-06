import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { SubscriberType } from '../types';
import { getSubscription } from './subscriptions';

// What happens to a subscriber's money when the subscriber goes away.
//
// Two moments, deliberately separate:
//
//   DELETED (fonderie.user.deleted — the account is soft-deleted and can no
//   longer sign in): stop every future charge. The subscription is canceled at
//   the provider, and off-session charging is disarmed (auto-recharge off, the
//   stored card forgotten). Nothing is erased: an account deleted by mistake
//   can still be restored, and its billing with it.
//
//   PURGED (fonderie.user.purged — the retention window passed and the account
//   row is gone): remove the personal data billing holds elsewhere. The
//   provider's customer record carries the email and the saved card, so it is
//   deleted there. The provider keeps its invoices; locally the subscription,
//   ledger and balances stay — financial records that accounting law generally
//   requires kept, and keyed only by an id that no longer resolves to a person.
//
//   The purge scheduler's in-process eraser (services/account-eraser.ts,
//   `accountEraser`) is the complete path: it runs BEFORE the row goes, so a
//   failure keeps the account and retries, it has the email, and it also
//   reaches workspace customers created with that email. This handler stays as
//   the backstop for a purge that does not run the erasers; after the eraser
//   it finds nothing left to do (a customer already gone is success).

// Well-known event names. Declared here rather than imported: billing takes no
// dependency on @fonderie/auth, which emits them.
export const USER_DELETED_EVENT = 'fonderie.user.deleted';
export const USER_PURGED_EVENT = 'fonderie.user.purged';
export const USER_RESTORED_EVENT = 'fonderie.user.restored';

export type SubscriberDeletedPolicy = 'cancel' | 'cancel-at-period-end' | 'keep';

interface ISubscriberRef {
	type: SubscriberType;
	id: string;
}

// "Already gone" at the provider is success here: the goal is a state, not an
// action, and a retry (the bus redelivers on throw) must be harmless.
export const alreadyGone = (err: unknown): boolean => {
	const e = err as { code?: string; statusCode?: number; message?: string };
	return (
		e?.code === 'resource_missing' ||
		e?.statusCode === 404 ||
		/No such (subscription|customer)|already (been )?canceled/i.test(String(e?.message ?? ''))
	);
};

export interface ISubscriberDeletedOutcome {
	canceled: 'now' | 'at-period-end' | 'none';
	chargingDisarmed: boolean;
}

export async function handleSubscriberDeleted(
	store: IStoreAdapter,
	config: Pick<IBillingConfig, 'provider' | 'onSubscriberDeleted'>,
	subscriber: ISubscriberRef,
): Promise<ISubscriberDeletedOutcome> {
	// Default: end at the period's end — the deleted account can no longer use
	// it, nothing more is charged, and restoring the account resumes it (D7).
	const policy = config.onSubscriberDeleted ?? 'cancel-at-period-end';
	const outcome: ISubscriberDeletedOutcome = { canceled: 'none', chargingDisarmed: false };
	if (policy === 'keep') return outcome;

	const current = await getSubscription(subscriber.type, subscriber.id, store);
	const live = current && current.status !== 'canceled' && current.providerSubscriptionId;
	// Already set to end by the person themselves: leave it, and never mark it
	// as ours — restoring must not undo a cancellation they chose.
	const alreadyEnding = policy === 'cancel-at-period-end' && current?.cancelAtPeriodEnd === true;
	if (live && !alreadyEnding && typeof config.provider.cancelSubscription === 'function') {
		const atPeriodEnd = policy === 'cancel-at-period-end';
		// Mark the subscription as ended by deletion BEFORE asking the provider,
		// and only while it is still the live one we read. A restore that runs
		// while the provider call is in flight then finds the mark (and clears
		// it); marked afterwards, a restore in that window found nothing to
		// resume and the kept account's subscription still ended.
		if (atPeriodEnd) {
			const claimed = await store.query(
				`UPDATE fonderie_subscriptions SET ended_by_account_deletion = true
				 WHERE subscriber_type = $1 AND subscriber_id = $2
				   AND provider_subscription_id = $3 AND status <> 'canceled'
				   AND (cancel_at_period_end = false OR ended_by_account_deletion = true)
				 RETURNING 1 AS claimed`,
				[subscriber.type, subscriber.id, current.providerSubscriptionId],
			);
			if (claimed.length === 0) return disarmCharging(store, subscriber, outcome);
		}
		try {
			// The provider's webhook confirms the new state and owns the stored
			// transition — the same rule the customer-initiated cancel follows, so
			// the terminal webhook is not mistaken for a redelivery.
			await config.provider.cancelSubscription({
				subscriptionId: current.providerSubscriptionId as string,
				atPeriodEnd,
			});
		} catch (err) {
			if (!alreadyGone(err)) throw err;
		}
		outcome.canceled = atPeriodEnd ? 'at-period-end' : 'now';
		if (atPeriodEnd) {
			// A restore cleared the mark while the cancel was in flight: the
			// account is kept, so the cancel this handler just made is undone
			// here (the restore may have resumed before the cancel landed).
			const [still] = await store.query<{ marked: boolean }>(
				`SELECT ended_by_account_deletion AS marked FROM fonderie_subscriptions
				 WHERE subscriber_type = $1 AND subscriber_id = $2`,
				[subscriber.type, subscriber.id],
			);
			if (!still?.marked) {
				outcome.canceled = 'none';
				if (typeof config.provider.reactivateSubscription === 'function') {
					try {
						await config.provider.reactivateSubscription({
							subscriptionId: current.providerSubscriptionId as string,
						});
					} catch (err) {
						// Not rethrown: a redelivered DELETION would cancel the kept
						// account's subscription again.
						console.error(
							'[billing] could not resume a subscription after its account was restored:',
							(err as Error).message,
						);
					}
				}
			}
		}
	}

	return disarmCharging(store, subscriber, outcome);
}

async function disarmCharging(
	store: IStoreAdapter,
	subscriber: ISubscriberRef,
	outcome: ISubscriberDeletedOutcome,
): Promise<ISubscriberDeletedOutcome> {
	// Off-session charges are the other way money moves without the person:
	// auto-recharge. Disarm it and forget the stored card id, so no code path
	// can charge a deleted account. The card itself goes with the provider
	// customer at purge.
	const rows = await store.query(
		`UPDATE fonderie_wallet_customers
		    SET auto_recharge_disabled = true, payment_method_id = NULL, pending_recharge_key = NULL, updated_at = now()
		  WHERE subscriber_type = $1 AND subscriber_id = $2
		  RETURNING subscriber_id`,
		[subscriber.type, subscriber.id],
	);
	outcome.chargingDisarmed = rows.length > 0;
	return outcome;
}

/**
 * The account was kept (fonderie.user.restored): resume a subscription that
 * deletion set to end at the period's end — only that one, never a
 * cancellation the person chose. Off-session charging stays off: the stored
 * card was forgotten at deletion, so they add one again.
 */
export async function handleSubscriberRestored(
	store: IStoreAdapter,
	config: Pick<IBillingConfig, 'provider'>,
	subscriber: ISubscriberRef,
): Promise<{ resumed: boolean }> {
	// Clear the mark and learn whether there was one in ONE statement: a
	// deletion still in flight checks the mark after its provider call, so it
	// sees this restore and undoes its own cancel.
	const [row] = await store.query<{ providerSubscriptionId: string | null; status: string }>(
		`UPDATE fonderie_subscriptions SET ended_by_account_deletion = false
		 WHERE subscriber_type = $1 AND subscriber_id = $2 AND ended_by_account_deletion = true
		 RETURNING provider_subscription_id AS "providerSubscriptionId", status`,
		[subscriber.type, subscriber.id],
	);
	if (!row) return { resumed: false };
	// The mark is only ever set when deletion chose to end the subscription, so
	// resuming never undoes a cancellation the person chose. The local
	// cancel_at_period_end is not consulted: the provider's webhook for the
	// deletion's cancel may not have landed yet, and resuming a subscription
	// that is not set to end is a no-op at the provider.
	if (row.status !== 'canceled' && row.providerSubscriptionId && typeof config.provider.reactivateSubscription === 'function') {
		// The provider's webhook confirms the new state, as for a customer reactivate.
		await config.provider.reactivateSubscription({ subscriptionId: row.providerSubscriptionId });
		return { resumed: true };
	}
	return { resumed: false };
}

export async function handleSubscriberPurged(
	store: IStoreAdapter,
	config: Pick<IBillingConfig, 'provider'>,
	subscriber: ISubscriberRef,
): Promise<{ customersDeleted: number }> {
	const ids = await store.query<{ id: string }>(
		`SELECT provider_customer_id AS id FROM fonderie_subscriptions
		  WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider_customer_id IS NOT NULL
		 UNION
		 SELECT provider_customer_id AS id FROM fonderie_wallet_customers
		  WHERE subscriber_type = $1 AND subscriber_id = $2
		 UNION
		 SELECT provider_customer_id AS id FROM fonderie_billing_customers
		  WHERE subscriber_type = $1 AND subscriber_id = $2 AND erased_at IS NULL`,
		[subscriber.type, subscriber.id],
	);
	if (typeof config.provider.deleteCustomer !== 'function') return { customersDeleted: 0 };
	let n = 0;
	for (const { id } of ids) {
		try {
			await config.provider.deleteCustomer(id);
			n++;
		} catch (err) {
			if (!alreadyGone(err)) throw err;
		}
	}
	return { customersDeleted: n };
}
