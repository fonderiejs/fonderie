import type { IAdminRoute, IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from './config';
import { toPlanDTO, toWalletDTO, toWalletTransactionDTO } from './dtos/billing';
import { getDBPlans, getPlans } from './services/plans';
import { getSubscription } from './services/subscriptions';
import { decodeLedgerCursor, getWalletBalance, getWalletLedger } from './services/wallet';
import { normalizeCurrency } from './utils';
import type { SubscriberType } from './types';

const ADMIN_PREFIX = '/_admin';

function subscriberOf(ctx: IFonderieContext): { type: SubscriberType; id: string } | null {
	const type = ctx.meta.params?.['type'];
	const id = ctx.meta.params?.['id'] ?? '';
	if ((type !== 'user' && type !== 'workspace') || !id) return null;
	return { type, id };
}

// config.plans carries bigint wallet amounts; shown as declared, bigints as strings.
const jsonSafe = <T>(v: T): unknown =>
	JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));

const BAD_SUBSCRIBER = () =>
	setApiResponse(
		HTTP.UNPROCESSABLE,
		'INVALID_PARAMETER',
		'subscriber is /:type/:id with type user|workspace',
	);

// The money reads the operator asks for: what am I selling, what is this
// subscriber on, what does their wallet hold. Declared at the default admin
// path so the route table reads literally; re-based by @fonderie/admin.
function readTable(
	store: IStoreAdapter,
	config: IBillingConfig,
): Array<[string, string, Middleware]> {
	const defaultCurrency = () => normalizeCurrency(config.wallet?.currency ?? 'USD');
	const routes: Array<[string, string, Middleware]> = [
		// Declared vs stored: config.plans is what the app sells; the DB rows are
		// what the plan writes produced. Both shown, so a divergence is visible.
		[
			'GET',
			'/_admin/catalog',
			async () => {
				const stored = (await getDBPlans(store)).map(toPlanDTO);
				return setApiResponse(HTTP.OK, 'CATALOG', 'Plans', {
					configured: jsonSafe(getPlans(config)),
					stored,
				});
			},
		],
		[
			'GET',
			'/_admin/subscriptions/:type/:id',
			async (ctx) => {
				const sub = subscriberOf(ctx);
				if (!sub) return BAD_SUBSCRIBER();
				const row = await getSubscription(sub.type, sub.id, store);
				return row
					? setApiResponse(HTTP.OK, 'SUBSCRIPTION', 'Subscription', row)
					: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No subscription for this subscriber');
			},
		],
	];
	if (config.wallet) {
		routes.push(
			[
				'GET',
				'/_admin/wallet/:type/:id',
				async (ctx) => {
					const sub = subscriberOf(ctx);
					if (!sub) return BAD_SUBSCRIBER();
					const q = new URL(ctx.request.url).searchParams.get('currency');
					const currency =
						q && /^[A-Za-z]{3,20}$/.test(q) ? normalizeCurrency(q) : defaultCurrency();
					const b = await getWalletBalance(
						{ subscriberType: sub.type, subscriberId: sub.id, currency },
						store,
					);
					const wallet = toWalletDTO(b.balance, currency, config.wallet?.precision ?? 2, {
						granted: b.granted,
						purchased: b.purchased,
						spendPurchased: b.spendPurchased,
						grantedExpiresAt: b.grantedExpiresAt,
					});
					return setApiResponse(HTTP.OK, 'WALLET', 'Wallet balance', {
						...wallet,
						version: b.version,
						updatedAt: b.updatedAt,
					});
				},
			],
			[
				'GET',
				'/_admin/wallet/:type/:id/ledger',
				async (ctx) => {
					const sub = subscriberOf(ctx);
					if (!sub) return BAD_SUBSCRIBER();
					const params = new URL(ctx.request.url).searchParams;
					const q = params.get('currency');
					const currency =
						q && /^[A-Za-z]{3,20}$/.test(q) ? normalizeCurrency(q) : defaultCurrency();
					const rawLimit = params.get('limit');
					const limit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 50;
					if (Number.isNaN(limit) || limit < 1 || limit > 100)
						return setApiResponse(
							HTTP.UNPROCESSABLE,
							'INVALID_PARAMETER',
							'limit must be an integer between 1 and 100',
						);
					const rawCursor = params.get('cursor');
					const cursor = rawCursor !== null ? decodeLedgerCursor(rawCursor) : null;
					if (rawCursor !== null && cursor === null)
						return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Malformed cursor');
					const page = await getWalletLedger(
						{
							subscriberType: sub.type,
							subscriberId: sub.id,
							currency,
							limit,
							...(cursor ? { cursor } : {}),
						},
						store,
					);
					return setApiResponse(HTTP.OK, 'WALLET_LEDGER', 'Wallet ledger', {
						currency,
						entries: page.entries.map(toWalletTransactionDTO),
						nextCursor: page.nextCursor,
					});
				},
			],
		);
	}
	return routes;
}

export function describeBillingAdminReads(
	store: IStoreAdapter,
	config: IBillingConfig,
): IAdminRoute[] {
	return readTable(store, config).map(([method, path, h]) => ({
		method,
		path: path.slice(ADMIN_PREFIX.length),
		handlers: [h],
	}));
}
