import type { IStoreAdapter } from '@fonderie/store';

export interface IProviderWebhookStats {
	/**
	 * How many subscriptions exist at all. Present because `lastEventAt: null`
	 * means two opposite things without it — nobody has ever subscribed, or
	 * subscriptions exist and no webhook has ever been accepted for them. Only
	 * the second is an outage, and the count is what tells them apart.
	 */
	subscriptions: number;
	/**
	 * When a subscription webhook was last ACCEPTED. Advances only on a
	 * signature-verified event, so it is the thing a working webhook moves.
	 */
	lastEventAt: Date | null;
	/** Wallet purchases credited within the window. */
	purchases: number;
	lastPurchaseAt: Date | null;
}

/**
 * Whether the payment provider is actually reaching this deployment.
 *
 * A stale webhook secret is the worst kind of outage: the provider charges the
 * card and reports success, the endpoint rejects the signature with a 400 that
 * exists only in a log, and the customer is paid-up with nothing credited.
 * Nothing in the product looks wrong until someone complains.
 *
 * These are the two things a webhook actually MOVES, so they detect it without
 * any provider API access. After re-pointing an endpoint or rotating a secret,
 * send a test event and watch `lastEventAt` advance; if it does not, the
 * signature is being rejected.
 *
 * Exposed here because the tables belong to this package. An app asking the
 * question should not have to hand-write SQL against a schema it does not own.
 */
export async function webhookStats(
	store: IStoreAdapter,
	options: { hours?: number } = {},
): Promise<IProviderWebhookStats> {
	const hours = options.hours ?? 24;
	const [subs, buys] = await Promise.all([
		store.query<{ total: string; last: Date | null }>(
			`SELECT count(*)::text AS total, max(provider_event_at) AS last
			   FROM fonderie_subscriptions`,
		),
		store.query<{ total: string; last: Date | null }>(
			`SELECT count(*)::text AS total, max(created_at) AS last
			   FROM fonderie_wallet_ledger
			  WHERE type = 'purchase' AND created_at > now() - make_interval(hours => $1)`,
			[hours],
		),
	]);
	const sub = subs[0];
	const buy = buys[0];
	return {
		subscriptions: Number(sub?.total ?? 0),
		lastEventAt: sub?.last ? new Date(sub.last) : null,
		purchases: Number(buy?.total ?? 0),
		lastPurchaseAt: buy?.last ? new Date(buy.last) : null,
	};
}
