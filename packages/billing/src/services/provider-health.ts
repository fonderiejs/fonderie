import type { IStoreAdapter } from '@fonderie/store';
import type { IBillingProvider, IWebhookRegistration } from '../providers/types';
import { PAYMENT_WEBHOOK_EVENTS, SUBSCRIPTION_WEBHOOK_EVENTS } from '../webhook-events';

/** One endpoint's verdict: what it should send vs what it is configured to send. */
export interface IWebhookRegistrationCheck {
	/** The URL we expected to find configured at the provider. */
	url: string;
	/** False when no endpoint with this URL exists at all. */
	registered: boolean;
	/** Provider-side status, when exposed — a 'disabled' endpoint sends nothing. */
	status?: string;
	/**
	 * Events this package HANDLES that the endpoint was never told to send.
	 * Non-empty means silent feature loss: the handler exists and can never run.
	 */
	missing: string[];
	/**
	 * Events the endpoint sends that nothing here consumes. Harmless — they
	 * return 200 and do nothing — but it means the config and the code disagree.
	 */
	unexpected: string[];
}

export interface IWebhookRegistrationReport {
	/** True when the provider cannot be asked (no API, or a test double). */
	unsupported?: boolean;
	/** Set when the provider was asked and refused/failed. */
	error?: string;
	endpoints: IWebhookRegistrationCheck[];
	/** True when every expected endpoint is registered, enabled, and complete. */
	ok: boolean;
}

/**
 * Compare what the provider is CONFIGURED to send against what this package
 * consumes.
 *
 * This is the only webhook failure that cannot be found by watching traffic. A
 * handler whose event was never registered simply never runs: no error, no log
 * line, no delivery to inspect — and "no invoice.payment_failed events yet" and
 * "invoice.payment_failed will never arrive" look exactly the same from inside
 * the app. Dunning silently stops happening.
 *
 * So the question has to be asked of the provider, not of our own traffic.
 *
 * Both URLs are optional: pass only the endpoints this deployment actually
 * serves. A provider without `listWebhookRegistrations` reports `unsupported`
 * rather than failing — absence of the capability is not evidence of a problem.
 */
export async function checkWebhookRegistration(
	provider: Pick<IBillingProvider, 'listWebhookRegistrations'>,
	urls: { subscriptionUrl?: string; paymentUrl?: string },
): Promise<IWebhookRegistrationReport> {
	if (typeof provider.listWebhookRegistrations !== 'function') {
		return { unsupported: true, endpoints: [], ok: true };
	}

	let registrations: IWebhookRegistration[];
	try {
		registrations = await provider.listWebhookRegistrations();
	} catch (err) {
		// Never throw from a health check — an unreachable provider must not take
		// down the route reporting on it.
		return {
			error: err instanceof Error ? err.message : String(err),
			endpoints: [],
			ok: false,
		};
	}

	const expected: { url: string | undefined; events: readonly string[] }[] = [
		{ url: urls.subscriptionUrl, events: SUBSCRIPTION_WEBHOOK_EVENTS },
		{ url: urls.paymentUrl, events: PAYMENT_WEBHOOK_EVENTS },
	];

	const endpoints: IWebhookRegistrationCheck[] = [];
	for (const { url, events } of expected) {
		if (!url) continue;
		const found = registrations.find((r) => sameEndpoint(r.url, url));
		if (!found) {
			endpoints.push({ url, registered: false, missing: [...events], unexpected: [] });
			continue;
		}
		// Stripe's '*' means every event type, so nothing can be missing.
		const wildcard = found.enabledEvents.includes('*');
		endpoints.push({
			url,
			registered: true,
			...(found.status ? { status: found.status } : {}),
			missing: wildcard ? [] : events.filter((e) => !found.enabledEvents.includes(e)),
			unexpected: wildcard
				? []
				: found.enabledEvents.filter((e) => !(events as readonly string[]).includes(e)),
		});
	}

	// `unexpected` deliberately does NOT affect ok: an extra event is noise, not
	// breakage. A disabled endpoint does, because it sends nothing at all.
	const ok = endpoints.every(
		(e) => e.registered && e.missing.length === 0 && e.status !== 'disabled',
	);
	return { endpoints, ok };
}

/** Compare ignoring a trailing slash, which providers and configs disagree on. */
function sameEndpoint(a: string, b: string): boolean {
	const norm = (s: string) => s.replace(/\/+$/, '');
	return norm(a) === norm(b);
}

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
