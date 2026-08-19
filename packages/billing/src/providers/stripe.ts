import type { IBillingProvider, IBillingEvent, INormalizedSubscription } from './types';
import type { SubscriberType } from '../types';

interface IStripeSubscriptionRaw {
	id: string;
	status: string;
	customer: string;
	metadata?: Record<string, string>;
	items: {
		data: Array<{
			price: { id: string; nickname: string | null; recurring?: { interval: string } };
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
		status: sub.status,
		providerCustomerId: sub.customer,
		providerSubscriptionId: sub.id,
		currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
		currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
		cancelAtPeriodEnd: sub.cancel_at_period_end,
		trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
		interval: item?.price.recurring?.interval === 'year' ? 'year' : 'month',
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
