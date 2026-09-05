import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS } from '../config';
import type { SubscriberType } from '../types';
import { SubscriptionModel } from '../models/subscription.model';
import { WalletModel } from '../models/wallet.model';
import { decodeLedgerCursor } from '../services/wallet';
import { findCreditPack } from '../services/credit-packs';
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
		if (q) return normalizeCurrency(q);
		return getWalletStatus(ctx)?.currency ?? defaultCurrency();
	};

	const precisionOf = (ctx: IFonderieContext) =>
		getWalletStatus(ctx)?.precision ?? config.wallet?.precision ?? 2;

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
			const { balance } = await wallet.balance({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency,
			});

			return setApiResponse(HTTP.OK, 'WALLET_FETCHED', 'Wallet retrieved successfully.', {
				wallet: toWalletDTO(balance, currency, precisionOf(ctx)),
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

			const session = await config.provider.createPaymentCheckoutSession({
				customerId,
				amount: pack.priceAmount,
				currency: chargeCurrency,
				name: pack.name,
				...(pack.priceId ? { priceId: pack.priceId } : {}),
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

			const currency = body.currency ? normalizeCurrency(body.currency) : defaultCurrency();
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
					bus
						?.emit(EVENT_KEYS.walletCredited, {
							...subscriberEventFields(body.subscriberType, body.subscriberId),
							currency,
							credits: body.amount.toString(),
							balanceAfter: result.balance.toString(),
							source: 'manual-grant',
						})
						.catch(() => {});
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
