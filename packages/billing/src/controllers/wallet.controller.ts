import { setApiResponse, HTTP, background } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS } from '../config';
import type { SubscriberType } from '../types';
import { SubscriptionModel } from '../models/subscription.model';
import { WalletModel } from '../models/wallet.model';
import { decodeLedgerCursor, resolvePlanWallet } from '../services/wallet';
import { findCreditPack } from '../services/credit-packs';
import { purchasePackWithSavedCard } from '../services/purchase';
import { DuplicateTransactionError } from '../errors';
import { toWalletDTO, toWalletTransactionDTO } from '../dtos/billing';
import { getWalletStatus } from '../helpers';
import { normalizeCurrency, resolveSubscriber, subscriberEventFields } from '../utils';

// The wallet routes are only registered when config.wallet is present, so
// config.wallet is always defined on these paths — defaults are still applied
// defensively.

export function walletController(store: IStoreAdapter, config: IBillingConfig, bus?: EventBus) {
	const wallet = new WalletModel(store);
	const subscriptions = new SubscriptionModel(store);

	const defaultCurrency = () => normalizeCurrency(config.wallet?.currency ?? 'USD');

	// ?currency= lets a multi-currency subscriber address a specific balance;
	// otherwise reads follow the same bucket every write path uses — the
	// subscriber's plan-wallet currency (cached by withBilling), then the
	// configured default.
	const currencyOf = (ctx: IFonderieContext) => {
		const q = new URL(ctx.request.url).searchParams.get('currency');
		// Only honor a well-formed currency code; a junk ?currency= otherwise
		// creates inert zero-amount balance rows under arbitrary keys. Falls back
		// to the subscriber's plan-wallet currency, then the configured default.
		if (q && /^[A-Za-z]{3,20}$/.test(q)) return normalizeCurrency(q);
		return getWalletStatus(ctx)?.currency ?? defaultCurrency();
	};

	const precisionOf = (ctx: IFonderieContext) =>
		getWalletStatus(ctx)?.precision ?? config.wallet?.precision ?? 2;

	// The wallet bucket a subscriber actually spends from is their PLAN-wallet
	// currency — the exact chain withBilling uses to snapshot ctx. A manual grant
	// with no explicit currency must target THIS, not the global default, or a
	// subscriber on a non-default-currency plan gets credits stranded in a bucket
	// they never spend from. Falls back to the default when the subscriber has no
	// subscription/plan or the plan carries no wallet block.
	const planWalletCurrencyOf = async (subscriberType: SubscriberType, subscriberId: string) => {
		const subscription = await subscriptions.get(subscriberType, subscriberId);
		const planName = subscription?.plan ?? config.plans[0]?.name ?? 'free';
		const plan = config.plans.find((p) => p.name === planName) ?? config.plans[0];
		return (plan ? resolvePlanWallet(plan, config)?.currency : undefined) ?? defaultCurrency();
	};

	// GAP-1 (opt-in): block packs for an active/trialing subscriber on a PAID plan
	// — that plan already includes its credits, so a pack would charge for coverage
	// the subscription provides. Shared by hosted checkout and in-app purchase so
	// they can't drift. Default off; free / pay-as-you-go / unpriced / past_due
	// subscribers are never blocked.
	const packsBlocked = (current: Awaited<ReturnType<typeof subscriptions.get>>): boolean => {
		if (!config.wallet?.blockPacksWhileSubscribed || !current) return false;
		const subPlan = config.plans.find((p) => p.name === current.plan);
		const paidPlan = !!(subPlan?.monthly || subPlan?.yearly);
		return paidPlan && (current.status === 'active' || current.status === 'trialing');
	};

	return {
		async get(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const currency = currencyOf(ctx);
			const snapshot = await wallet.balance({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency,
			});

			return setApiResponse(HTTP.OK, 'WALLET_FETCHED', 'Wallet retrieved successfully.', {
				wallet: toWalletDTO(snapshot.balance, currency, precisionOf(ctx), {
					granted: snapshot.granted,
					purchased: snapshot.purchased,
					spendPurchased: snapshot.spendPurchased,
					grantedExpiresAt: snapshot.grantedExpiresAt,
				}),
			});
		},

		// Set the per-subscriber spend-purchased toggle, then return the refreshed
		// wallet (same { wallet } shape as get, so a client can update its view
		// from the response without a second fetch). Currency-scoped like get.
		async setPreferences(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			const body = ctx.meta['body'] as { spendPurchased: boolean };
			const currency = currencyOf(ctx);
			await wallet.setSpendPurchased({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency,
				spendPurchased: body.spendPurchased,
			});
			const snapshot = await wallet.balance({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency,
			});
			return setApiResponse(HTTP.OK, 'WALLET_PREFERENCES_UPDATED', 'Wallet preferences updated.', {
				wallet: toWalletDTO(snapshot.balance, currency, precisionOf(ctx), {
					granted: snapshot.granted,
					purchased: snapshot.purchased,
					spendPurchased: snapshot.spendPurchased,
					grantedExpiresAt: snapshot.grantedExpiresAt,
				}),
			});
		},

		async transactions(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const params = new URL(ctx.request.url).searchParams;
			const rawLimit = params.get('limit');
			const limit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 50;
			if (Number.isNaN(limit) || limit < 1 || limit > 100) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'limit must be an integer between 1 and 100',
				);
			}

			const rawCursor = params.get('cursor');
			const cursor = rawCursor !== null ? decodeLedgerCursor(rawCursor) : null;
			if (rawCursor !== null && cursor === null) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Malformed cursor');
			}

			const page = await wallet.ledger({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency: currencyOf(ctx),
				limit,
				...(cursor ? { cursor } : {}),
			});

			return setApiResponse(
				HTTP.OK,
				'WALLET_TRANSACTIONS',
				`Retrieved ${page.entries.length} wallet transactions`,
				{
					transactions: page.entries.map(toWalletTransactionDTO),
					nextCursor: page.nextCursor,
				},
			);
		},

		// One-time checkout for a credit pack. The pack's credits and the
		// buyer's WALLET currency are snapshotted into the session metadata at
		// creation time, so the webhook credits exactly what was bought (even
		// if config changes later) into the bucket the buyer's spend paths
		// actually read. pack.currency only prices the provider charge.
		async checkout(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as { packId: string };
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const pack = findCreditPack(body.packId, config);
			if (!pack) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					`Unknown credit pack: ${body.packId}`,
				);
			}

			if (!config.provider.createPaymentCheckoutSession) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'PAYMENT_NOT_SUPPORTED',
					`Provider '${config.provider.name}' does not support one-time payments`,
				);
			}

			// The wallet bucket to credit: the buyer's plan-wallet currency
			// (cached by withBilling), falling back to the global default. A
			// pack priced in EUR must still credit the USD wallet a USD-plan
			// subscriber spends from — otherwise the purchase would land in a
			// bucket no spend path ever reads.
			const creditCurrency = getWalletStatus(ctx)?.currency ?? defaultCurrency();
			const chargeCurrency = normalizeCurrency(pack.currency ?? creditCurrency);

			// Reuse the subscription's provider customer when one exists (same
			// convention as the subscription checkout) — pack purchases then
			// share payment history and saved methods with the subscription.
			const current = await subscriptions.get(subscriber.type, subscriber.id);

			// GAP-1 (opt-in): a paid subscription already includes its credits.
			if (packsBlocked(current)) {
				return setApiResponse(
					HTTP.CONFLICT,
					'PACKS_BLOCKED',
					'Credit packs are not available on your current plan — it already includes credits.',
				);
			}

			const customerId =
				current?.providerCustomerId ??
				(
					await config.provider.createCustomer({
						email: ctx.user!.email ?? '',
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						userId: ctx.user!.id,
					})
				).customerId;

			// Save the card for later off-session charges only when this
			// subscriber's plan enables auto-recharge — so we never store a card
			// (and shoulder its consent burden) unless it will actually be used.
			const planName = current?.plan ?? config.plans[0]?.name;
			const plan = config.plans.find((p) => p.name === planName);
			const savePaymentMethod = plan?.wallet?.autoRecharge != null;

			const session = await config.provider.createPaymentCheckoutSession({
				customerId,
				amount: pack.priceAmount,
				currency: chargeCurrency,
				name: pack.name,
				...(pack.priceId ? { priceId: pack.priceId } : {}),
				...(savePaymentMethod ? { savePaymentMethod: true } : {}),
				metadata: {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					packId: pack.id,
					credits: pack.credits.toString(),
					currency: creditCurrency,
				},
				successUrl: config.successUrl,
				cancelUrl: config.cancelUrl,
			});

			return setApiResponse(HTTP.OK, 'CHECKOUT_URL', 'Checkout session created.', {
				url: session.url,
				sessionId: session.sessionId,
			});
		},

		// One-time pack purchase charged against the saved card — the in-app path
		// so a buyer with a card on file never leaves the site. Resolves to a
		// status the client acts on: `credited` (done, no redirect),
		// `checkout_required` (no saved card / SCA needed → fall back to hosted
		// checkout), `declined`, or `processing` (indeterminate — retry with the
		// SAME idempotencyKey). Money-safety lives in purchasePackWithSavedCard.
		async purchase(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as { packId: string; idempotencyKey: string };
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}

			const pack = findCreditPack(body.packId, config);
			if (!pack) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', `Unknown credit pack: ${body.packId}`);
			}

			const current = await subscriptions.get(subscriber.type, subscriber.id);
			if (packsBlocked(current)) {
				return setApiResponse(
					HTTP.CONFLICT,
					'PACKS_BLOCKED',
					'Credit packs are not available on your current plan — it already includes credits.',
				);
			}

			const outcome = await purchasePackWithSavedCard({
				store,
				config,
				bus,
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				packId: pack.id,
				// Credit the bucket the buyer spends from — their plan-wallet currency.
				creditCurrency: getWalletStatus(ctx)?.currency ?? defaultCurrency(),
				precision: precisionOf(ctx),
				idempotencyKey: body.idempotencyKey,
			});

			switch (outcome.status) {
				case 'credited':
					return setApiResponse(HTTP.OK, 'WALLET_PURCHASED', 'Credit pack purchased.', {
						status: 'credited',
						balance: outcome.balance.toString(),
						currency: outcome.currency,
						credits: outcome.credits.toString(),
						duplicate: outcome.duplicate,
					});
				case 'checkout_required':
					// A normal outcome, not an error: the client falls back to
					// POST /billing/wallet/checkout (hosted, which collects a card / does 3DS).
					return setApiResponse(HTTP.OK, 'CHECKOUT_REQUIRED', 'Hosted checkout required.', {
						status: 'checkout_required',
						reason: outcome.reason,
					});
				case 'declined':
					return setApiResponse(HTTP.OK, 'PAYMENT_DECLINED', 'The saved card was declined.', {
						status: 'declined',
					});
				case 'processing':
					return setApiResponse(
						HTTP.OK,
						'PURCHASE_PROCESSING',
						'Payment is processing — retry with the same idempotencyKey.',
						{ status: 'processing' },
					);
				default:
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', `Unknown credit pack: ${body.packId}`);
			}
		},

		// Admin-token-guarded manual grant (support/ops). Body is validated and
		// transformed by grantWalletSchema — amount arrives as a bigint.
		async grant(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as {
				subscriberType: SubscriberType;
				subscriberId: string;
				amount: bigint;
				currency?: string;
				description?: string;
				idempotencyKey: string;
			};

			const currency = body.currency
				? normalizeCurrency(body.currency)
				: await planWalletCurrencyOf(body.subscriberType, body.subscriberId);
			try {
				const result = await wallet.credit({
					subscriberType: body.subscriberType,
					subscriberId: body.subscriberId,
					currency,
					amount: body.amount,
					type: 'grant',
					description: body.description ?? 'Manual grant',
					idempotencyKey: body.idempotencyKey,
				});
				// Publish only on a real credit — a replayed idempotency key
				// returns duplicate:true and must not re-emit.
				if (!result.duplicate) {
					await background(bus
						?.emit(EVENT_KEYS.walletCredited, {
							...subscriberEventFields(body.subscriberType, body.subscriberId),
							currency,
							credits: body.amount.toString(),
							balanceAfter: result.balance.toString(),
							source: 'manual-grant',
						}));
				}

				return setApiResponse(HTTP.OK, 'WALLET_GRANTED', 'Credits granted.', {
					balance: result.balance.toString(),
					currency,
					duplicate: result.duplicate,
				});
			} catch (err) {
				if (err instanceof DuplicateTransactionError) {
					return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_TRANSACTION', err.message);
				}
				throw err;
			}
		},
	};
}
