import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { SubscriberType } from '../types';
import { WalletModel } from '../models/wallet.model';
import { decodeLedgerCursor } from '../services/wallet';
import { DuplicateTransactionError } from '../errors';
import { toWalletDTO, toWalletTransactionDTO } from '../dtos/billing';
import { resolveSubscriber } from '../utils';

// The wallet routes are only registered when config.wallet is present, so
// config.wallet is always defined on these paths — defaults are still applied
// defensively.

export function walletController(store: IStoreAdapter, config: IBillingConfig) {
	const wallet = new WalletModel(store);

	const defaultCurrency = () => config.wallet?.currency ?? 'USD';
	const precision = () => config.wallet?.precision ?? 2;

	// ?currency= lets a multi-currency subscriber address a specific balance;
	// defaults to the configured wallet currency.
	const currencyOf = (ctx: IFonderieContext) => {
		const q = new URL(ctx.request.url).searchParams.get('currency');
		return q ? q.toUpperCase() : defaultCurrency();
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
			const { balance } = await wallet.balance({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				currency,
			});

			return setApiResponse(HTTP.OK, 'WALLET_FETCHED', 'Wallet retrieved successfully.', {
				wallet: toWalletDTO(balance, currency, precision()),
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

			const currency = body.currency ?? defaultCurrency();
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
