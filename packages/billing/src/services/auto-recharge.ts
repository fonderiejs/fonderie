import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { SubscriberType } from '../types';
import type { IResolvedPlanWallet } from './wallet';
import { creditWallet } from './wallet';
import { findCreditPack } from './credit-packs';
import {
	claimAutoRecharge,
	clearPendingRechargeKey,
	recordRechargeFailure,
	recordRechargeSuccess,
	setPendingRechargeKey,
} from './wallet-customers';
import { notifyBilling } from './notify';
import { normalizeCurrency, subscriberEventFields } from '../utils';

const DEFAULT_COOLDOWN_SECONDS = 3600;
const DEFAULT_MAX_FAILURES = 3;

// Automatic off-session top-up. Called fire-and-forget by withBilling when a
// subscriber's balance is at/below the plan's autoRecharge threshold. Every
// safety property lives here so the caller can ignore the outcome:
//   - a per-subscriber atomic CLAIM (claimAutoRecharge) guarantees at most one
//     charge per cooldown even under a burst of concurrent requests, and a
//     failed attempt still consumes the window (declined cards aren't hammered);
//   - the wallet credit is idempotent on the provider charge id, so a retry
//     never double-credits;
//   - a decline resolves to a status (not a throw) → recorded, notified, backed
//     off, and disabled after N consecutive failures (re-armed by a new purchase).
// Requires the provider to implement chargeOffSession and a card to be on file
// (persisted at the last pack purchase); absent either, it is a no-op.
export async function maybeAutoRecharge(args: {
	store: IStoreAdapter;
	config: IBillingConfig;
	bus: EventBus | undefined;
	subscriberType: SubscriberType;
	subscriberId: string;
	balance: bigint;
	planWallet: IResolvedPlanWallet;
}): Promise<void> {
	const { store, config, bus, subscriberType, subscriberId, balance, planWallet } = args;
	const auto = planWallet.autoRecharge;
	if (!auto || balance > auto.threshold) return;
	if (typeof config.provider.chargeOffSession !== 'function') return;

	const pack = findCreditPack(auto.packId, config);
	if (!pack) return; // misconfigured packId — flagged at boot, no-op at runtime

	const provider = config.provider.name;
	const key = { subscriberType, subscriberId, provider };

	// Atomic claim — only the winner proceeds, and only if a card is on file,
	// not disabled, and the cooldown has elapsed. Floor the cooldown at 1s: the
	// claim's mutual exclusion relies on the window exceeding the burst's time
	// skew, so a 0/sub-second cooldown would let concurrent requests all win.
	const cooldownSeconds = Math.max(1, auto.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);
	const claim = await claimAutoRecharge({ ...key, cooldownSeconds }, store);
	if (!claim) return;

	// Reuse the key of an unresolved prior charge (so the provider dedupes to
	// the same PaymentIntent — no double charge); otherwise mint a fresh one and
	// persist it BEFORE charging, so an indeterminate outcome is recoverable.
	const idempotencyKey =
		claim.pendingKey ?? `${provider}:autorecharge:${subscriberType}:${subscriberId}:${claim.claimedAt}`;
	if (!claim.pendingKey) await setPendingRechargeKey(key, idempotencyKey, store);

	const creditCurrency = planWallet.currency;
	const chargeCurrency = normalizeCurrency(pack.currency ?? creditCurrency);
	const charge = await config.provider.chargeOffSession({
		customerId: claim.providerCustomerId,
		paymentMethodId: claim.paymentMethodId,
		amount: pack.priceAmount,
		currency: chargeCurrency,
		idempotencyKey,
		metadata: {
			subscriberType,
			subscriberId,
			packId: pack.id,
			credits: pack.credits.toString(),
			currency: creditCurrency,
			reason: 'auto-recharge',
		},
	});

	// INDETERMINATE (network/timeout): the charge may have captured. Do NOT
	// count it as a decline and do NOT clear the pending key — the next window
	// retries with the same key so the provider returns the original PI. Leaving
	// it pending is what prevents the double-charge.
	if (charge.status === 'unknown') return;

	if (charge.status !== 'succeeded' || !charge.providerTxId) {
		// Definitive non-capture (decline / SCA / no card) — the key can be
		// released; a fresh attempt later is correct.
		await clearPendingRechargeKey(key, store);
		const { disabled } = await recordRechargeFailure(
			{ ...key, maxConsecutiveFailures: auto.maxConsecutiveFailures ?? DEFAULT_MAX_FAILURES },
			store,
		);
		bus
			?.emit(EVENT_KEYS.autoRechargeFailed, {
				...subscriberEventFields(subscriberType, subscriberId),
				currency: creditCurrency,
				packId: pack.id,
				status: charge.status,
				disabled,
			})
			.catch(() => {});
		void notifyBilling(bus, config, {
			subscriberType,
			subscriberId,
			type: MESSAGE_KEYS.autoRechargeFailed,
			data: { packId: pack.id, status: charge.status, disabled },
		});
		return;
	}

	// Funds captured — credit the wallet. Idempotent on the charge id so a
	// retry or a duplicate delivery never double-credits. amountPaid +
	// paymentCurrency mirror the manual purchase path so a later refund/
	// chargeback of THIS charge can prorate the credit clawback (without them,
	// handleReversal has no basis and reverses nothing — the value-leak).
	const result = await creditWallet(
		{
			subscriberType,
			subscriberId,
			currency: creditCurrency,
			amount: pack.credits,
			type: 'purchase',
			idempotencyKey: `${provider}:autorecharge:${charge.providerTxId}`,
			description: `Auto-recharge pack ${pack.id}`,
			providerTxId: charge.providerTxId,
			metadata: {
				packId: pack.id,
				source: 'auto-recharge',
				providerTxId: charge.providerTxId,
				amountPaid: pack.priceAmount.toString(),
				paymentCurrency: chargeCurrency,
			},
		},
		store,
	);
	// Release the pending key ONLY after the credit has committed. If
	// creditWallet threw (transient DB error) the key stays set, so the next
	// window reuses it, the provider dedupes to the same captured PaymentIntent,
	// and the idempotent credit finally lands — one charge, one credit.
	await recordRechargeSuccess(key, store);
	await clearPendingRechargeKey(key, store);

	if (!result.duplicate) {
		const fields = {
			...subscriberEventFields(subscriberType, subscriberId),
			currency: creditCurrency,
			credits: pack.credits.toString(),
			balanceAfter: result.balance.toString(),
			packId: pack.id,
			providerTxId: charge.providerTxId,
		};
		bus?.emit(EVENT_KEYS.creditPackPurchased, fields).catch(() => {});
		bus?.emit(EVENT_KEYS.walletCredited, { ...fields, source: 'auto-recharge' }).catch(() => {});
		void notifyBilling(bus, config, {
			subscriberType,
			subscriberId,
			type: MESSAGE_KEYS.paymentReceipt,
			data: {
				packId: pack.id,
				credits: pack.credits.toString(),
				currency: creditCurrency,
				balanceAfter: result.balance.toString(),
				source: 'auto-recharge',
			},
		});
	}
}
