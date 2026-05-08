import type { IBillingProvider, IBillingEvent, INormalizedSubscription } from './types';

interface IStripeSubscriptionRaw {
	id:                   string
	status:               string
	customer:             string
	metadata?:            Record<string, string>
	items:                { data: Array<{ price: { id: string; nickname: string | null } }> }
	current_period_start: number
	current_period_end:   number
	cancel_at_period_end: boolean
	trial_end:            number | null
}

interface IStripeEventRaw {
	type: string
	data: { object: unknown }
}

// Lazy singleton — Stripe SDK is optional
let _client: unknown = null;

async function getClient(secretKey: string): Promise<unknown> {
	if (_client) {
		return _client;
	}

	const pkg = 'stripe';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mod: any = await import(pkg).catch(() => {
		throw new Error('[billing:stripe] stripe is required: npm install stripe');
	});

	// Stripe SDK exports as default in CJS but as .default in ESM
	const Stripe = mod.default ?? mod;

	_client = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });

	return _client;
}


function normalizeSubscription(sub: IStripeSubscriptionRaw): INormalizedSubscription {
	return {
		workspaceId:            sub.metadata?.['workspaceId'] ?? '',
		plan:                   sub.items.data[0]?.price.nickname ?? 'unknown',
		status:                 sub.status,
		providerCustomerId:     sub.customer,
		providerSubscriptionId: sub.id,
		currentPeriodStart:     new Date(sub.current_period_start * 1000),
		currentPeriodEnd:       new Date(sub.current_period_end   * 1000),
		cancelAtPeriodEnd:      sub.cancel_at_period_end,
		trialEndsAt:            sub.trial_end ? new Date(sub.trial_end * 1000) : null,
	}
}

export class StripeProvider implements IBillingProvider {
	readonly name = 'stripe'

	constructor(
		private secretKey:     string,
		private webhookSecret?: string,
	) {}

	private async client(): Promise<any> {
		return getClient(this.secretKey);
	}

	async createCustomer(opts: {
		email:       string
		workspaceId: string
		userId:      string
	}): Promise<{ customerId: string }> {
		const stripe = await this.client();
		const customer = await stripe.customers.create({
			email:    opts.email,
			metadata: { workspaceId: opts.workspaceId, userId: opts.userId },
		});

		return { customerId: customer.id };
	}

	async createCheckoutSession(opts: {
		customerId:  string
		priceId:     string
		workspaceId: string
		trialDays?:  number
		successUrl:  string
		cancelUrl:   string
	}): Promise<{ url: string }> {
		const stripe  = await this.client();
		const session = await stripe.checkout.sessions.create({
			customer:    opts.customerId,
			mode:        'subscription',
			line_items:  [{ price: opts.priceId, quantity: 1 }],
			success_url: opts.successUrl,
			cancel_url:  opts.cancelUrl,
			...(opts.trialDays && opts.trialDays > 0
				? { subscription_data: { trial_period_days: opts.trialDays } }
				: {}),
		});

		return { url: session.url ?? '' };
	}

	async createPortalSession(opts: {
		customerId: string
		returnUrl:  string
	}): Promise<{ url: string }> {
		const stripe  = await this.client();
		const session = await stripe.billingPortal.sessions.create({
			customer:   opts.customerId,
			return_url: opts.returnUrl,
		});

		return { url: session.url };
	}

	async constructEvent(opts: {
		payload:   string
		signature: string
		secret:    string
	}): Promise<IBillingEvent> {
		const stripe = await this.client();

		let raw: IStripeEventRaw
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

		const sub = raw.data.object as IStripeSubscriptionRaw

		if (raw.type === 'customer.subscription.deleted') {
			return {
				type:         raw.type,
				subscription: {
					...normalizeSubscription(sub),
					plan:   'free',
					status: 'canceled',
				},
			};
		}

		return {
			type:         raw.type,
			subscription: normalizeSubscription(sub),
		};
	}
}
