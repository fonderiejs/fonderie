import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { SubscriberType } from '../types';
import { creditWallet } from './wallet';
import { findCreditPack } from './credit-packs';
import { getWalletCustomer, upsertWalletCustomer } from './wallet-customers';
import { notifyBilling } from './notify';
import { normalizeCurrency, subscriberEventFields, formatWalletAmount } from '../utils';

// The resolved outcome of an in-app purchase attempt. Every branch is a status
// (not a throw) so the caller can decide UI vs. hosted-checkout fallback.
export type IPurchaseOutcome =
	| {
			status: 'credited';
			balance: bigint;
			credits: bigint;
			currency: string;
			duplicate: boolean;
			providerTxId: string;
	  }
	| { status: 'checkout_required'; reason: 'no_saved_card' | 'authentication_required' }
	| { status: 'declined' }
	| { status: 'processing' }
	| { status: 'invalid_pack' };

// Interactive credit-pack purchase charged against the subscriber's saved card —
// the in-app alternative to hosted checkout, so a buyer with a card on file never
// leaves the site. Money-safety mirrors maybeAutoRecharge:
//   - the charge is idempotent on the client-supplied key, so a double-submit or a
//     retry after an indeterminate response dedupes to the same PaymentIntent;
//   - the wallet credit is idempotent on the resulting charge id, so nothing
//     double-credits;
//   - a decline / SCA requirement / missing card resolves to a status the caller
//     turns into a hosted-checkout fallback rather than a hard error.
export async function purchasePackWithSavedCard(args: {
	store: IStoreAdapter;
	config: IBillingConfig;
	bus: EventBus | undefined;
	subscriberType: SubscriberType;
	subscriberId: string;
	packId: string;
	creditCurrency: string;
	precision: number;
	idempotencyKey: string;
}): Promise<IPurchaseOutcome> {
	const { store, config, bus, subscriberType, subscriberId, packId, creditCurrency, precision, idempotencyKey } =
		args;

	const pack = findCreditPack(packId, config);
	if (!pack) return { status: 'invalid_pack' };

	// Needs a saved card AND a provider that can charge it in-app. Prefer a real
	// invoice (chargeViaInvoice → the buyer gets an invoice + PDF, Anthropic-style);
	// fall back to a bare off-session charge (receipt only). Absent both — or no
	// card on file — fall back to hosted checkout (which collects a card itself).
	const canInvoice = typeof config.provider.chargeViaInvoice === 'function';
	const canCharge = typeof config.provider.chargeOffSession === 'function';
	if (!canInvoice && !canCharge) {
		return { status: 'checkout_required', reason: 'no_saved_card' };
	}
	const provider = config.provider.name;
	const customer = await getWalletCustomer({ subscriberType, subscriberId, provider }, store);
	if (!customer?.providerCustomerId || !customer.paymentMethodId) {
		return { status: 'checkout_required', reason: 'no_saved_card' };
	}

	// pack.currency prices the provider charge; creditCurrency is the wallet bucket
	// the buyer actually spends from (their plan-wallet currency).
	const chargeCurrency = normalizeCurrency(pack.currency ?? creditCurrency);
	// Namespace the client key by subscriber: provider idempotency keys are
	// account-scoped, so two subscribers reusing the same client string must not
	// collide (the loser would be rejected as a param mismatch → a bogus decline).
	const chargeKey = `${provider}:purchase:${subscriberType}:${subscriberId}:${idempotencyKey}`;
	// The invoice metadata also lets the invoice.paid webhook heal an indeterminate
	// outcome (credit keyed on the same PaymentIntent id → no double-credit).
	const chargeMetadata = {
		subscriberType,
		subscriberId,
		packId: pack.id,
		credits: pack.credits.toString(),
		currency: creditCurrency,
		reason: 'purchase',
	};
	const charge = canInvoice
		? await config.provider.chargeViaInvoice!({
				customerId: customer.providerCustomerId,
				paymentMethodId: customer.paymentMethodId,
				amount: pack.priceAmount,
				currency: chargeCurrency,
				description: pack.name,
				idempotencyKey: chargeKey,
				metadata: chargeMetadata,
			})
		: await config.provider.chargeOffSession!({
				customerId: customer.providerCustomerId,
				paymentMethodId: customer.paymentMethodId,
				amount: pack.priceAmount,
				currency: chargeCurrency,
				idempotencyKey: chargeKey,
				metadata: chargeMetadata,
			});

	// The card needs 3-D Secure: an off-session charge can't authenticate it, but
	// the buyer is present — hand off to hosted checkout, which does 3DS in-flow.
	if (charge.status === 'requires_action') {
		return { status: 'checkout_required', reason: 'authentication_required' };
	}
	// Indeterminate (network/timeout): the charge MAY have captured. Do NOT fall
	// back to checkout — that could double-charge. Tell the caller to retry with
	// the SAME idempotencyKey so the provider returns the original PaymentIntent.
	if (charge.status === 'unknown') return { status: 'processing' };
	// Definitive decline — no funds moved.
	if (charge.status !== 'succeeded' || !charge.providerTxId) return { status: 'declined' };

	// Funds captured — credit the wallet, idempotent on the charge id so neither a
	// double-submit nor a redelivered event double-credits. amountPaid +
	// paymentCurrency mirror the hosted-checkout credit so a later refund/chargeback
	// of THIS charge can prorate the clawback (handleReversal joins back by
	// providerTxId).
	const result = await creditWallet(
		{
			subscriberType,
			subscriberId,
			currency: creditCurrency,
			amount: pack.credits,
			type: 'purchase',
			idempotencyKey: `${provider}:purchase:${charge.providerTxId}`,
			description: `Credit pack ${pack.id}`,
			providerTxId: charge.providerTxId,
			metadata: {
				packId: pack.id,
				source: 'in-app-purchase',
				providerTxId: charge.providerTxId,
				amountPaid: pack.priceAmount.toString(),
				paymentCurrency: chargeCurrency,
			},
		},
		store,
	);

	// Persist the customer + card and re-arm auto-recharge on a genuine purchase —
	// mirrors the hosted-checkout webhook so both purchase paths behave alike.
	// Best-effort: the credit has already committed.
	try {
		await upsertWalletCustomer(
			{
				subscriberType,
				subscriberId,
				provider,
				providerCustomerId: customer.providerCustomerId,
				rearm: !result.duplicate,
				paymentMethodId: customer.paymentMethodId,
			},
			store,
		);
	} catch {
		// auto-recharge stays as-is until the next successful purchase re-arms it.
	}

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
		bus?.emit(EVENT_KEYS.walletCredited, { ...fields, source: 'purchase' }).catch(() => {});
		void notifyBilling(bus, config, {
			subscriberType,
			subscriberId,
			type: MESSAGE_KEYS.paymentReceipt,
			data: {
				packId: pack.id,
				credits: pack.credits.toString(),
				currency: creditCurrency,
				balanceAfter: result.balance.toString(),
				creditsDisplay: formatWalletAmount(pack.credits, creditCurrency, precision),
				balanceAfterDisplay: formatWalletAmount(result.balance, creditCurrency, precision),
				source: 'in-app-purchase',
			},
		});
	}

	return {
		status: 'credited',
		balance: result.balance,
		credits: pack.credits,
		currency: creditCurrency,
		duplicate: result.duplicate,
		providerTxId: charge.providerTxId,
	};
}
