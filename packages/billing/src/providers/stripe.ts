import type {
	IBillingProvider,
	IBillingEvent,
	INormalizedPayment,
	INormalizedSubscription,
	IResolvedPrice,
} from './types';
import { BILLING_INTERVAL } from '../types';
import type { SubscriberType } from '../types';
import { moneyToNumber } from '../utils';

interface IStripeSubscriptionRaw {
	id: string;
	status: string;
	customer: string;
	metadata?: Record<string, string>;
	items: {
		data: Array<{
			price: { id: string; nickname: string | null; lookup_key?: string | null; recurring?: { interval: string } };
			// Since Stripe API 2025+, the period lives on the item, not the subscription.
			current_period_start?: number;
			current_period_end?: number;
		}>;
	};
	// Older API versions (pre-2025) expose the period on the subscription itself.
	current_period_start?: number;
	current_period_end?: number;
	cancel_at_period_end: boolean;
	trial_end: number | null;
}

interface IStripeEventRaw {
	type: string;
	data: { object: unknown };
}

export interface IStripeCheckoutSessionRaw {
	id: string;
	mode?: string;
	payment_intent?: string | { id: string } | null;
	amount_total?: number | null;
	currency?: string | null;
	payment_status?: string | null;
	metadata?: Record<string, string> | null;
}

// Pure normalization of a completed payment-mode checkout session — exported
// for tests (constructEvent itself needs the Stripe SDK for signatures).
export function normalizePaymentSession(session: IStripeCheckoutSessionRaw): INormalizedPayment {
	const pi = session.payment_intent;
	return {
		sessionId: session.id,
		providerTxId: typeof pi === 'string' ? pi : (pi?.id ?? null),
		amountTotal: session.amount_total != null ? BigInt(session.amount_total) : null,
		currency: session.currency ?? null,
		paymentStatus: session.payment_status ?? null,
		metadata: session.metadata ?? {},
	};
}

// Lazy singleton — Stripe SDK is optional
let _client: unknown = null;

async function getClient(secretKey: string): Promise<unknown> {
	if (_client) return _client;

	const pkg = 'stripe';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mod: any = await import(pkg).catch(() => {
		throw new Error('[billing:stripe] stripe is required: npm install stripe');
	});

	const Stripe = mod.default ?? mod;
	_client = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });
	return _client;
}

function normalizeSubscription(sub: IStripeSubscriptionRaw): INormalizedSubscription {
	const item = sub.items.data[0];
	// Period moved from the subscription to the item in Stripe API 2025+; read the
	// item first, fall back to the subscription-level fields for older versions.
	const periodStart = item?.current_period_start ?? sub.current_period_start;
	const periodEnd = item?.current_period_end ?? sub.current_period_end;
	return {
		subscriberType: (sub.metadata?.['subscriberType'] ?? 'workspace') as SubscriberType,
		subscriberId: sub.metadata?.['subscriberId'] ?? '',
		plan: item?.price.nickname ?? 'unknown',
		priceLookupKey: item?.price.lookup_key ?? null,
		priceId: item?.price.id ?? null,
		status: sub.status,
		providerCustomerId: sub.customer,
		providerSubscriptionId: sub.id,
		currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
		currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
		cancelAtPeriodEnd: sub.cancel_at_period_end,
		trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
		interval: item?.price.recurring?.interval === BILLING_INTERVAL.YEAR ? BILLING_INTERVAL.YEAR : BILLING_INTERVAL.MONTH,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResolvedPrice(p: any): IResolvedPrice {
	return {
		priceId: p.id,
		lookupKey: p.lookup_key ?? null,
		unitAmount: BigInt(p.unit_amount ?? 0),
		currency: p.currency,
		interval: p.recurring?.interval === BILLING_INTERVAL.YEAR ? BILLING_INTERVAL.YEAR : BILLING_INTERVAL.MONTH,
		nickname: p.nickname ?? null,
		productId: typeof p.product === 'string' ? p.product : (p.product?.id ?? ''),
		active: p.active ?? true,
	};
}

export class StripeProvider implements IBillingProvider {
	readonly name = 'stripe';

	constructor(
		private secretKey: string,
		private webhookSecret?: string,
	) {}

	private async client(): Promise<any> {
		return getClient(this.secretKey);
	}

	async createCustomer(opts: {
		email: string;
		subscriberType: SubscriberType;
		subscriberId: string;
		userId: string;
	}): Promise<{ customerId: string }> {
		const stripe = await this.client();
		const customer = await stripe.customers.create({
			email: opts.email,
			metadata: {
				subscriberType: opts.subscriberType,
				subscriberId: opts.subscriberId,
				userId: opts.userId,
			},
		});
		return { customerId: customer.id };
	}

	async createCheckoutSession(opts: {
		customerId: string;
		priceId: string;
		subscriberType: SubscriberType;
		subscriberId: string;
		trialDays?: number;
		successUrl: string;
		cancelUrl: string;
	}): Promise<{ url: string }> {
		const stripe = await this.client();
		const session = await stripe.checkout.sessions.create({
			customer: opts.customerId,
			mode: 'subscription',
			line_items: [{ price: opts.priceId, quantity: 1 }],
			success_url: opts.successUrl,
			cancel_url: opts.cancelUrl,
			subscription_data: {
				metadata: {
					subscriberType: opts.subscriberType,
					subscriberId: opts.subscriberId,
				},
				...(opts.trialDays && opts.trialDays > 0 ? { trial_period_days: opts.trialDays } : {}),
			},
		});
		return { url: session.url ?? '' };
	}

	async createPaymentCheckoutSession(opts: {
		customerId: string;
		amount: bigint;
		currency: string;
		name: string;
		quantity?: number;
		priceId?: string;
		metadata: Record<string, string>;
		successUrl: string;
		cancelUrl: string;
	}): Promise<{ url: string; sessionId: string }> {
		const stripe = await this.client();
		const lineItem = opts.priceId
			? { price: opts.priceId, quantity: opts.quantity ?? 1 }
			: {
					price_data: {
						currency: opts.currency.toLowerCase(),
						// Stripe's SDK takes a JS number; moneyToNumber throws past 2^53
						// instead of silently rounding.
						unit_amount: moneyToNumber(opts.amount),
						product_data: { name: opts.name },
					},
					quantity: opts.quantity ?? 1,
				};
		const session = await stripe.checkout.sessions.create({
			customer: opts.customerId,
			mode: 'payment',
			line_items: [lineItem],
			success_url: opts.successUrl,
			cancel_url: opts.cancelUrl,
			metadata: opts.metadata,
		});
		return { url: session.url ?? '', sessionId: session.id };
	}

	async resolvePriceById(priceId: string): Promise<IResolvedPrice | null> {
		const stripe = await this.client();
		try {
			const p = await stripe.prices.retrieve(priceId, { expand: ['product'] });
			return toResolvedPrice(p);
		} catch {
			return null;
		}
	}

	async resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>> {
		const out = new Map<string, IResolvedPrice>();
		if (lookupKeys.length === 0) return out;
		const stripe = await this.client();
		const res = await stripe.prices.list({
			lookup_keys: lookupKeys,
			active: true,
			expand: ['data.product'],
			limit: 100,
		});
		for (const p of res.data) {
			if (p.lookup_key) out.set(p.lookup_key, toResolvedPrice(p));
		}
		return out;
	}

	async updateSubscription(opts: {
		subscriptionId: string;
		priceId: string;
	}): Promise<{ status: string; currentPeriodStart: Date | null; currentPeriodEnd: Date | null }> {
		const stripe = await this.client();
		const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
		const itemId = sub.items.data[0]?.id;
		// Swap the price on the existing item and invoice the prorated difference
		// immediately (upgrade → pay the difference now).
		const updated = await stripe.subscriptions.update(opts.subscriptionId, {
			items: [{ id: itemId, price: opts.priceId }],
			proration_behavior: 'always_invoice',
			payment_behavior: 'error_if_incomplete',
		});
		const item = updated.items?.data?.[0];
		const cps = item?.current_period_start ?? updated.current_period_start;
		const cpe = item?.current_period_end ?? updated.current_period_end;
		return {
			status: updated.status,
			currentPeriodStart: cps ? new Date(cps * 1000) : null,
			currentPeriodEnd: cpe ? new Date(cpe * 1000) : null,
		};
	}

	async createPortalSession(opts: {
		customerId: string;
		returnUrl: string;
	}): Promise<{ url: string }> {
		const stripe = await this.client();
		const session = await stripe.billingPortal.sessions.create({
			customer: opts.customerId,
			return_url: opts.returnUrl,
		});
		return { url: session.url };
	}

	async constructEvent(opts: {
		payload: string;
		signature: string;
		secret: string;
	}): Promise<IBillingEvent> {
		const stripe = await this.client();

		let raw: IStripeEventRaw;
		try {
			raw = stripe.webhooks.constructEvent(opts.payload, opts.signature, opts.secret);
		} catch {
			throw new Error('[billing:stripe] Invalid webhook signature');
		}

		// One-time payment events — normalized for the payment webhook.
		// checkout.session.completed can arrive with payment_status 'unpaid'
		// for delayed-notification methods; the paid follow-up is
		// checkout.session.async_payment_succeeded. Subscription-mode checkout
		// completions pass through untouched (the subscription lifecycle
		// arrives via customer.subscription.* events).
		if (
			raw.type === 'checkout.session.completed' ||
			raw.type === 'checkout.session.async_payment_succeeded'
		) {
			const session = raw.data.object as IStripeCheckoutSessionRaw;
			if (session.mode === 'payment') {
				return { type: raw.type, subscription: null, payment: normalizePaymentSession(session) };
			}
			return { type: raw.type, subscription: null };
		}

		const isSubscriptionEvent = [
			'customer.subscription.created',
			'customer.subscription.updated',
			'customer.subscription.deleted',
		].includes(raw.type);

		if (!isSubscriptionEvent) {
			return { type: raw.type, subscription: null };
		}

		const sub = raw.data.object as IStripeSubscriptionRaw;

		if (raw.type === 'customer.subscription.deleted') {
			return {
				type: raw.type,
				subscription: { ...normalizeSubscription(sub), plan: 'free', status: 'canceled' },
			};
		}

		return { type: raw.type, subscription: normalizeSubscription(sub) };
	}
}
