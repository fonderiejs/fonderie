import type { IStoreAdapter } from '@fonderie/store';

import type { SubscriberType } from '../types';

// Provider-customer persistence + the auto-recharge guard. A credit-pack
// purchase records the customer that holds the saved card (re-arming
// auto-recharge); the threshold trigger then CLAIMS a top-up slot atomically so
// a burst of requests near the threshold fires at most one charge per cooldown.

export interface IWalletCustomerKey {
	subscriberType: SubscriberType;
	subscriberId: string;
	provider: string;
}

// Store (or refresh) the provider customer for a subscriber. The customer id is
// updated on every call, but the auto-recharge disable flag + failure counter
// are RE-ARMED only when `rearm` is true — i.e. on a genuinely new successful
// purchase (a working card). A duplicate/replayed webhook of an OLD purchase
// must pass rearm=false so it cannot resurrect an auto-recharge that failures
// already disabled. last_recharge_at is left untouched so a purchase doesn't
// reset the cooldown window.
export async function upsertWalletCustomer(
	key: IWalletCustomerKey & { providerCustomerId: string; rearm: boolean },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_wallet_customers
			(subscriber_type, subscriber_id, provider, provider_customer_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (subscriber_type, subscriber_id, provider) DO UPDATE SET
			provider_customer_id   = EXCLUDED.provider_customer_id,
			auto_recharge_disabled = CASE WHEN $5 THEN false ELSE fonderie_wallet_customers.auto_recharge_disabled END,
			consecutive_failures   = CASE WHEN $5 THEN 0 ELSE fonderie_wallet_customers.consecutive_failures END,
			updated_at             = now()`,
		[key.subscriberType, key.subscriberId, key.provider, key.providerCustomerId, key.rearm],
	);
}

// Atomically claim a top-up slot. Returns the provider customer id ONLY when a
// recharge is eligible (a card is on file, auto-recharge is not disabled, and
// the cooldown has elapsed) and records the attempt time in the same statement,
// so concurrent callers race on one row and exactly one wins. A failed attempt
// still consumes the window (the claim commits before the charge), preventing a
// declined card from being retried every request. null ⇒ do not charge.
export interface IAutoRechargeClaim {
	providerCustomerId: string;
	/** The attempt timestamp just written — a stable token for a fresh charge's idempotency key. */
	claimedAt: string;
	/**
	 * The idempotency key of a still-unresolved prior charge, if any. When set,
	 * the caller MUST reuse it (not mint a fresh one from claimedAt) so the
	 * provider dedupes to the original PaymentIntent instead of double-charging.
	 */
	pendingKey: string | null;
}

export async function claimAutoRecharge(
	key: IWalletCustomerKey & { cooldownSeconds: number },
	store: IStoreAdapter,
): Promise<IAutoRechargeClaim | null> {
	const [row] = await store.query<{
		providerCustomerId: string;
		claimedAt: string;
		pendingKey: string | null;
	}>(
		`UPDATE fonderie_wallet_customers
		SET last_recharge_at = now(), updated_at = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider = $3
			AND auto_recharge_disabled = false
			AND (last_recharge_at IS NULL OR last_recharge_at < now() - make_interval(secs => $4))
		RETURNING provider_customer_id AS "providerCustomerId",
			last_recharge_at::text AS "claimedAt",
			pending_recharge_key AS "pendingKey"`,
		[key.subscriberType, key.subscriberId, key.provider, key.cooldownSeconds],
	);
	return row
		? { providerCustomerId: row.providerCustomerId, claimedAt: row.claimedAt, pendingKey: row.pendingKey }
		: null;
}

// Record the idempotency key of a charge about to be attempted, so an
// indeterminate outcome can be safely retried with the same key next window.
export async function setPendingRechargeKey(
	key: IWalletCustomerKey,
	idempotencyKey: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_wallet_customers SET pending_recharge_key = $4, updated_at = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider = $3`,
		[key.subscriberType, key.subscriberId, key.provider, idempotencyKey],
	);
}

// Clear the pending key once a charge resolves definitively.
export async function clearPendingRechargeKey(key: IWalletCustomerKey, store: IStoreAdapter): Promise<void> {
	await store.query(
		`UPDATE fonderie_wallet_customers SET pending_recharge_key = NULL, updated_at = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider = $3`,
		[key.subscriberType, key.subscriberId, key.provider],
	);
}

export async function recordRechargeSuccess(key: IWalletCustomerKey, store: IStoreAdapter): Promise<void> {
	await store.query(
		`UPDATE fonderie_wallet_customers
		SET consecutive_failures = 0, updated_at = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider = $3`,
		[key.subscriberType, key.subscriberId, key.provider],
	);
}

// Count a failed attempt; disable auto-recharge once failures reach the limit
// (the next successful purchase re-arms it). Returns whether it is now disabled.
export async function recordRechargeFailure(
	key: IWalletCustomerKey & { maxConsecutiveFailures: number },
	store: IStoreAdapter,
): Promise<{ disabled: boolean }> {
	const [row] = await store.query<{ autoRechargeDisabled: boolean }>(
		`UPDATE fonderie_wallet_customers
		SET consecutive_failures   = consecutive_failures + 1,
			auto_recharge_disabled = (consecutive_failures + 1 >= $4),
			updated_at             = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND provider = $3
		RETURNING auto_recharge_disabled AS "autoRechargeDisabled"`,
		[key.subscriberType, key.subscriberId, key.provider, key.maxConsecutiveFailures],
	);
	return { disabled: row?.autoRechargeDisabled ?? false };
}
