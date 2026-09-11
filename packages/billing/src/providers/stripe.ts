import type {
	IBillingProvider,
	IBillingEvent,
	INormalizedCard,
	INormalizedInvoice,
	INormalizedInvoiceSummary,
	INormalizedPayment,
	INormalizedPaymentFailure,
	INormalizedReversal,
	INormalizedSubscription,
	IResolvedPrice,
	ISubscriptionChange,
} from './types';
import { BILLING_INTERVAL, isBillingInterval } from '../types';
import type { BillingInterval, SubscriberType } from '../types';
import { toSafeNumber } from '../utils';

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
	// Unix seconds when Stripe emitted the event — the ordering key for
	// at-least-once, unordered subscription webhooks.
	created?: number;
	data: { object: unknown };
}

export interface IStripeCheckoutSessionRaw {
	id: string;
	mode?: string;
	customer?: string | { id: string } | null;
	payment_intent?: string | { id: string } | null;
	amount_total?: number | null;
	currency?: string | null;
	payment_status?: string | null;
	metadata?: Record<string, string> | null;
}

// charge.refunded delivers the Charge with its full (cumulative) refunds list.
interface IStripeChargeRaw {
	id: string;
	payment_intent?: string | { id: string } | null;
	currency?: string | null;
	amount?: number | null;
	amount_captured?: number | null;
	amount_refunded?: number | null;
	created?: number | null;
	status?: string | null;
	paid?: boolean | null;
	receipt_url?: string | null;
	// The invoice this charge settles, if any. One-time payments (credit-pack
	// purchases, whether hosted checkout or an in-app PaymentIntent) have none —
	// that's how we tell them apart from subscription-invoice charges.
	invoice?: string | { id: string } | null;
	refunds?: { data?: Array<{ id: string; amount?: number | null; reason?: string | null }> } | null;
	metadata?: Record<string, string> | null;
}

// charge.dispute.created / .closed deliver the Dispute.
interface IStripeDisputeRaw {
	id: string;
	charge?: string | { id: string } | null;
	payment_intent?: string | { id: string } | null;
	amount?: number | null;
	currency?: string | null;
	reason?: string | null;
	status?: string | null;
	metadata?: Record<string, string> | null;
}

// invoice.paid / invoice.payment_failed deliver the Invoice.
interface IStripeInvoiceRaw {
	id: string;
	number?: string | null;
	status?: string | null;
	created?: number | null;
	hosted_invoice_url?: string | null;
	invoice_pdf?: string | null;
	currency?: string | null;
	amount_paid?: number | null;
	amount_due?: number | null;
	due_date?: number | null;
	payment_intent?: string | { id: string } | null;
	subscription?: string | { id: string } | null;
	customer?: string | { id: string } | null;
	metadata?: Record<string, string> | null;
}

// A PaymentMethod's card block (display fields + the stable card fingerprint).
interface IStripeCardRaw {
	brand: string;
	last4: string;
	exp_month: number;
	exp_year: number;
	fingerprint?: string | null;
}

// payment_intent.payment_failed delivers the PaymentIntent.
interface IStripePaymentIntentRaw {
	id: string;
	amount?: number | null;
	currency?: string | null;
	customer?: string | { id: string } | null;
	last_payment_error?: { message?: string | null; code?: string | null } | null;
	metadata?: Record<string, string> | null;
}

// Stripe reference fields are `string | { id } | null` (id, or the expanded
// object, or absent). Collapse to the id string, tolerating every shape.
function refId(ref: string | { id: string } | null | undefined): string | null {
	return typeof ref === 'string' ? ref : (ref?.id ?? null);
}

// Pure normalization of a completed payment-mode checkout session — exported
// for tests (constructEvent itself needs the Stripe SDK for signatures).
export function normalizePaymentSession(session: IStripeCheckoutSessionRaw): INormalizedPayment {
	return {
		sessionId: session.id,
		providerTxId: refId(session.payment_intent),
		customerId: refId(session.customer),
		amountTotal: session.amount_total != null ? BigInt(session.amount_total) : null,
		currency: session.currency ?? null,
		paymentStatus: session.payment_status ?? null,
		metadata: session.metadata ?? {},
	};
}

// Pure normalization of a charge.refunded event. The event carries the full
// refunds list, ordered most-recent-first (Stripe list ordering), so data[0]
// is the refund this event announces. Its own `amount` is the per-event delta
// — `charge.amount_refunded` is cumulative and would double-count across
// partial refunds, so prefer the refund's own amount. Keying idempotency off
// this refund's own id is what makes each partial refund a distinct clawback;
// picking the wrong (older) entry would collide keys and silently drop every
// refund after the first.
export function normalizeChargeRefund(charge: IStripeChargeRaw): INormalizedReversal {
	const list = charge.refunds?.data ?? [];
	const latest = list.length > 0 ? list[0] : undefined;
	const amount =
		latest?.amount != null
			? BigInt(latest.amount)
			: charge.amount_refunded != null
				? BigInt(charge.amount_refunded)
				: null;
	return {
		kind: 'refund',
		id: latest?.id ?? charge.id,
		providerTxId: refId(charge.payment_intent),
		chargeId: charge.id,
		amount,
		currency: charge.currency ?? null,
		reason: latest?.reason ?? null,
		status: null,
		metadata: charge.metadata ?? {},
	};
}

// Pure normalization of a charge.dispute.created / .closed event.
export function normalizeDispute(dispute: IStripeDisputeRaw): INormalizedReversal {
	return {
		kind: 'dispute',
		id: dispute.id,
		providerTxId: refId(dispute.payment_intent),
		chargeId: refId(dispute.charge),
		amount: dispute.amount != null ? BigInt(dispute.amount) : null,
		currency: dispute.currency ?? null,
		reason: dispute.reason ?? null,
		status: dispute.status ?? null,
		metadata: dispute.metadata ?? {},
	};
}

// Pure normalization of an invoice.paid / invoice.payment_failed event. The
// amount comes from amount_paid (paid) or amount_due (failed).
export function normalizeInvoice(
	inv: IStripeInvoiceRaw,
	status: 'paid' | 'payment_failed',
): INormalizedInvoice {
	const raw = status === 'paid' ? inv.amount_paid : inv.amount_due;
	return {
		id: inv.id,
		status,
		amount: raw != null ? BigInt(raw) : null,
		currency: inv.currency ?? null,
		providerTxId: refId(inv.payment_intent),
		providerSubscriptionId: refId(inv.subscription),
		providerCustomerId: refId(inv.customer),
		metadata: inv.metadata ?? {},
	};
}

// Pure normalization of a failed one-time payment ATTEMPT — the checkout-session
// variant (async_payment_failed) carries a session id; the PaymentIntent
// variant does not.
export function normalizePaymentFailureFromSession(
	session: IStripeCheckoutSessionRaw,
): INormalizedPaymentFailure {
	return {
		sessionId: session.id,
		providerTxId: refId(session.payment_intent),
		amount: session.amount_total != null ? BigInt(session.amount_total) : null,
		currency: session.currency ?? null,
		reason: null,
		metadata: session.metadata ?? {},
	};
}

export function normalizePaymentFailureFromIntent(pi: IStripePaymentIntentRaw): INormalizedPaymentFailure {
	return {
		sessionId: null,
		providerTxId: pi.id,
		amount: pi.amount != null ? BigInt(pi.amount) : null,
		currency: pi.currency ?? null,
		reason: pi.last_payment_error?.message ?? pi.last_payment_error?.code ?? null,
		metadata: pi.metadata ?? {},
	};
}

// A succeeded bare PaymentIntent (no checkout session) — the shape the payment
// webhook credits as the in-app-purchase safety net. sessionId has no session to
// carry, so the PaymentIntent id stands in; the webhook keys the credit off the
// metadata reason, not the sessionId, so it dedupes with the synchronous credit.
export function normalizePaymentIntentSucceeded(pi: IStripePaymentIntentRaw): INormalizedPayment {
	return {
		sessionId: pi.id,
		providerTxId: pi.id,
		customerId: refId(pi.customer),
		amountTotal: pi.amount != null ? BigInt(pi.amount) : null,
		currency: pi.currency ?? null,
		paymentStatus: 'paid', // payment_intent.succeeded ⇒ funds captured
		metadata: pi.metadata ?? {},
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

// Stripe also supports 'day' and 'week' recurring prices; the framework's
// billing model is month/year. Anything else keeps the historical MONTH
// fallback — loudly, so a weekly price can't silently masquerade as monthly.
export function toBillingInterval(raw: string | undefined): BillingInterval {
	if (isBillingInterval(raw)) return raw;
	if (raw !== undefined) {
		// eslint-disable-next-line no-console
		console.warn(
			`[billing:stripe] unsupported price interval '${raw}' — recording as '${BILLING_INTERVAL.MONTH}'`,
		);
	}
	return BILLING_INTERVAL.MONTH;
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
		interval: toBillingInterval(item?.price.recurring?.interval),
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResolvedPrice(p: any): IResolvedPrice {
	return {
		priceId: p.id,
		lookupKey: p.lookup_key ?? null,
		unitAmount: BigInt(p.unit_amount ?? 0),
		currency: p.currency,
		interval: toBillingInterval(p.recurring?.interval),
		nickname: p.nickname ?? null,
		productId: typeof p.product === 'string' ? p.product : (p.product?.id ?? ''),
		active: p.active ?? true,
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSubscriptionChange(sub: any): ISubscriptionChange {
	const item = sub.items?.data?.[0];
	const cpe = item?.current_period_end ?? sub.current_period_end;
	return {
		status: sub.status,
		cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
		currentPeriodEnd: cpe ? new Date(cpe * 1000) : null,
	};
}

// The payment method types the in-app card-save SetupIntent can offer. Reference
// these instead of raw strings for `setupPaymentMethodTypes`. Both stay on-page
// (neither needs an off-site redirect), but only CARD yields a payment method with
// a `card` object — one that shows as "Visa •••• 4242" and reads back as a card on
// file. LINK (Stripe Link) is off-session-chargeable, but its PM is type:'link'
// with no card details, so it can't be displayed as a stored card.
export const SUPPORTED_PAYMENT_OPTIONS = {
	CARD: 'card',
	LINK: 'link',
} as const;

export type SupportedPaymentOption =
	(typeof SUPPORTED_PAYMENT_OPTIONS)[keyof typeof SUPPORTED_PAYMENT_OPTIONS];

export interface IStripeProviderOptions {
	// Payment method types the in-app card-save SetupIntent (`createSetupIntent`)
	// offers. Defaults to `[SUPPORTED_PAYMENT_OPTIONS.CARD]` — a concrete,
	// displayable, off-session-chargeable card that stays on-page. Broaden it (e.g.
	// `[SUPPORTED_PAYMENT_OPTIONS.CARD, SUPPORTED_PAYMENT_OPTIONS.LINK]`) to offer
	// wallets, accepting that non-card methods won't render as a card on file. This
	// is the consumer's policy — the brick doesn't hard-code it.
	setupPaymentMethodTypes?: SupportedPaymentOption[];
}

export class StripeProvider implements IBillingProvider {
	readonly name = 'stripe';

	constructor(
		private secretKey: string,
		private webhookSecret?: string,
		private options: IStripeProviderOptions = {},
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
		idempotencyKey?: string;
	}): Promise<{ url: string }> {
		const stripe = await this.client();
		const session = await stripe.checkout.sessions.create(
			{
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
			},
			// Retried session-create requests carrying the same key dedupe to one
			// session instead of a second subscription.
			opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
		);
		return { url: session.url ?? '' };
	}

	async createPaymentCheckoutSession(opts: {
		customerId: string;
		amount: bigint;
		currency: string;
		name: string;
		quantity?: number;
		priceId?: string;
		savePaymentMethod?: boolean;
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
						// Stripe's SDK takes a JS number; toSafeNumber throws past 2^53
						// instead of silently rounding.
						unit_amount: toSafeNumber(opts.amount),
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
			// The charge (PaymentIntent) must carry the pack metadata itself, not
			// only the session: a refund/chargeback normalizes from the CHARGE, and
			// without its own metadata the wallet clawback has no packId to attribute
			// (the value-leak). Also save the card for later off-session auto-recharge
			// when the operator has surfaced consent to store it for reuse.
			payment_intent_data: {
				metadata: opts.metadata,
				...(opts.savePaymentMethod ? { setup_future_usage: 'off_session' } : {}),
			},
		});
		return { url: session.url ?? '', sessionId: session.id };
	}

	// Charge the customer's saved card with no user present (wallet auto-recharge).
	// Resolves the card from the customer when one isn't given; maps a decline /
	// authentication-required outcome to a status instead of throwing, so the
	// caller backs off cleanly. Stripe's own idempotency key dedupes retries.
	async chargeOffSession(opts: {
		customerId: string;
		paymentMethodId?: string | null;
		amount: bigint;
		currency: string;
		idempotencyKey: string;
		metadata: Record<string, string>;
	}): Promise<{
		providerTxId: string | null;
		status: 'succeeded' | 'requires_action' | 'failed' | 'unknown';
	}> {
		try {
			const stripe = await this.client();
			// Charge the specific consented card when known; otherwise fall back to
			// the customer's most recently attached card.
			let paymentMethod = opts.paymentMethodId ?? undefined;
			if (!paymentMethod) {
				const methods = await stripe.paymentMethods.list({
					customer: opts.customerId,
					type: 'card',
					limit: 1,
				});
				paymentMethod = methods.data?.[0]?.id;
			}
			// No card on file is a definitive fail (nothing to reconcile).
			if (!paymentMethod) return { providerTxId: null, status: 'failed' };

			const pi = await stripe.paymentIntents.create(
				{
					amount: toSafeNumber(opts.amount),
					currency: opts.currency.toLowerCase(),
					customer: opts.customerId,
					payment_method: paymentMethod,
					off_session: true,
					confirm: true,
					metadata: opts.metadata,
				},
				{ idempotencyKey: opts.idempotencyKey },
			);
			const status = pi.status === 'succeeded' ? 'succeeded' : 'requires_action';
			return { providerTxId: pi.id ?? null, status };
		} catch (err) {
			// Classify the outcome. DEFINITIVE (do not retry the same charge):
			// a card error (declined / SCA), or an invalid-request error such as a
			// stored payment method that was detached/deleted (resource_missing) —
			// retrying with the same key can't succeed, so record a failure and
			// back off rather than looping. INDETERMINATE (a connection/timeout/API
			// error): the charge may have captured, so report 'unknown' and let the
			// caller retry with the SAME idempotency key.
			const e = err as {
				type?: string;
				rawType?: string;
				code?: string;
				payment_intent?: { id?: string };
			};
			const t = e?.type ?? e?.rawType;
			const isCardError = t === 'StripeCardError' || t === 'card_error';
			const isInvalidRequest = t === 'StripeInvalidRequestError' || t === 'invalid_request_error';
			if (!isCardError && !isInvalidRequest) {
				return { providerTxId: e?.payment_intent?.id ?? null, status: 'unknown' };
			}
			const status = e?.code === 'authentication_required' ? 'requires_action' : 'failed';
			return { providerTxId: e?.payment_intent?.id ?? null, status };
		}
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
		prorationBehavior?: 'always_invoice' | 'create_prorations';
	}): Promise<{ status: string; currentPeriodStart: Date | null; currentPeriodEnd: Date | null }> {
		const stripe = await this.client();
		const sub = await stripe.subscriptions.retrieve(opts.subscriptionId);
		const itemId = sub.items.data[0]?.id;
		// Swap the price on the existing item. Upgrade (default) invoices the
		// difference now; downgrade ('create_prorations') credits the unused
		// higher-plan time onto the next invoice rather than issuing a refund.
		const updated = await stripe.subscriptions.update(opts.subscriptionId, {
			items: [{ id: itemId, price: opts.priceId }],
			proration_behavior: opts.prorationBehavior ?? 'always_invoice',
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

	async cancelSubscription(opts: {
		subscriptionId: string;
		atPeriodEnd: boolean;
	}): Promise<ISubscriptionChange> {
		const stripe = await this.client();
		// At period end: flag it (access continues until paid-through). Immediate:
		// end now. Stripe emits customer.subscription.updated / .deleted for both,
		// so the webhook confirms state + owns the customer notice — this method
		// only performs the change and returns the resulting state.
		const sub = opts.atPeriodEnd
			? await stripe.subscriptions.update(opts.subscriptionId, { cancel_at_period_end: true })
			: await stripe.subscriptions.cancel(opts.subscriptionId);
		return toSubscriptionChange(sub);
	}

	async reactivateSubscription(opts: { subscriptionId: string }): Promise<ISubscriptionChange> {
		const stripe = await this.client();
		const sub = await stripe.subscriptions.update(opts.subscriptionId, {
			cancel_at_period_end: false,
		});
		return toSubscriptionChange(sub);
	}

	// The card a completed PaymentIntent used — persisted so auto-recharge later
	// re-charges that exact (consented) card. Tolerant: any failure → null (the
	// caller falls back to the newest card).
	async getPaymentMethodForIntent(providerTxId: string): Promise<string | null> {
		try {
			const stripe = await this.client();
			const pi = await stripe.paymentIntents.retrieve(providerTxId);
			const pm = pi?.payment_method;
			return typeof pm === 'string' ? pm : (pm?.id ?? null);
		} catch {
			return null;
		}
	}

	// Charge the saved card via a real Stripe INVOICE (not a bare PaymentIntent),
	// so the buyer gets a proper invoice — number + downloadable PDF + hosted page —
	// alongside the card receipt (Anthropic-style). Flow: draft invoice (currency
	// pinned to the charge currency — the account default may differ) → line item →
	// finalize → pay off-session. Idempotent per step on the caller's key so a
	// double-submit or retry never creates a second invoice/charge. `invoice.metadata`
	// carries the purchase attribution so the invoice.paid webhook can heal an
	// indeterminate outcome. SCA/decline resolve to a status (not a throw); the
	// finalized-but-unpaid invoice is voided so it doesn't linger as "open".
	async chargeViaInvoice(opts: {
		customerId: string;
		paymentMethodId?: string | null;
		amount: bigint;
		currency: string;
		description: string;
		idempotencyKey: string;
		metadata: Record<string, string>;
	}): Promise<{
		status: 'succeeded' | 'requires_action' | 'failed' | 'unknown';
		providerTxId: string | null;
		invoiceId: string | null;
		invoiceNumber: string | null;
		hostedInvoiceUrl: string | null;
		invoicePdf: string | null;
	}> {
		const stripe = await this.client();
		const currency = opts.currency.toLowerCase();
		const pm = opts.paymentMethodId ?? undefined;
		const k = opts.idempotencyKey;

		// Extract the PaymentIntent id from a paid invoice. The current API exposes
		// it under `payments[].payment.payment_intent`, not the legacy
		// `invoice.payment_intent`; support both defensively.
		const piIdOf = (invoice: any): string | null => {
			const legacy = invoice?.payment_intent;
			if (legacy) return typeof legacy === 'string' ? legacy : (legacy.id ?? null);
			const pay = invoice?.payments?.data?.[0]?.payment?.payment_intent;
			return typeof pay === 'string' ? pay : (pay?.id ?? null);
		};
		const summaryOf = (invoice: any) => ({
			invoiceId: invoice?.id ?? null,
			invoiceNumber: invoice?.number ?? null,
			hostedInvoiceUrl: invoice?.hosted_invoice_url ?? null,
			invoicePdf: invoice?.invoice_pdf ?? null,
		});

		const nulls = { providerTxId: null, invoiceId: null, invoiceNumber: null, hostedInvoiceUrl: null, invoicePdf: null } as const;
		// Best-effort void/delete of a created-but-unpaid invoice so it doesn't
		// linger as a dangling draft/open invoice. A draft (item/finalize failed)
		// must be deleted; a finalized one is voided — try both, swallow errors.
		const discard = async (id: string) => {
			await stripe.invoices.voidInvoice(id).catch(async () => {
				await stripe.invoices.del(id).catch(() => {});
			});
		};

		// Draft → item → finalize. A failure here is definitive (no charge yet);
		// discard any invoice we created before returning.
		let invoiceId: string;
		try {
			const draft = await stripe.invoices.create(
				{
					customer: opts.customerId,
					currency,
					collection_method: 'charge_automatically',
					auto_advance: false,
					...(pm ? { default_payment_method: pm } : {}),
					metadata: opts.metadata,
				},
				{ idempotencyKey: `${k}:invoice` },
			);
			invoiceId = draft.id;
			await stripe.invoiceItems.create(
				{
					customer: opts.customerId,
					invoice: invoiceId,
					amount: toSafeNumber(opts.amount),
					currency,
					description: opts.description,
				},
				{ idempotencyKey: `${k}:item` },
			);
			await stripe.invoices.finalizeInvoice(invoiceId, { auto_advance: false }, { idempotencyKey: `${k}:finalize` });
		} catch {
			// invoiceId is only set once create succeeded; TS-narrow via a guard.
			if (typeof invoiceId! === 'string') await discard(invoiceId!);
			return { status: 'failed', ...nulls };
		}

		// Pay off-session. NOTE: no `expand` here — the pinned API returns the PI on
		// the legacy `invoice.payment_intent`, which piIdOf reads (with a
		// payments[]-shape fallback for newer API versions).
		try {
			const paid = await stripe.invoices.pay(
				invoiceId,
				{ off_session: true, ...(pm ? { payment_method: pm } : {}) },
				{ idempotencyKey: `${k}:pay` },
			);
			if (paid.status === 'paid') {
				const pi = piIdOf(paid);
				// Paid but the PaymentIntent id didn't resolve (unexpected). Do NOT
				// report succeeded-with-null — the caller would map that to a false
				// "declined" and invite a second charge. Report unknown so it shows
				// "processing" and the invoice.paid webhook / a same-key retry heals it.
				if (!pi) return { status: 'unknown', ...summaryOf(paid), providerTxId: null };
				return { status: 'succeeded', providerTxId: pi, ...summaryOf(paid) };
			}
			// Finalized but not paid (e.g. needs action) — void so it doesn't linger.
			await discard(invoiceId);
			return { status: 'requires_action', ...nulls };
		} catch (err) {
			const e = err as { type?: string; rawType?: string; code?: string };
			const t = e?.type ?? e?.rawType;
			const isCard = t === 'StripeCardError' || t === 'card_error';
			const isInvalid = t === 'StripeInvalidRequestError' || t === 'invalid_request_error';
			// Card needs 3-D Secure off-session → the buyer is present, fall back to
			// hosted checkout. A plain decline is a hard failure. Both are definitive
			// (no capture) so the finalized invoice is voided.
			if (isCard || isInvalid) {
				await discard(invoiceId);
				const status = isCard && e.code === 'authentication_required' ? 'requires_action' : 'failed';
				return { status, ...nulls };
			}
			// Network/timeout — the pay MAY have captured. Leave the invoice as-is
			// (do NOT void — that could cancel a real payment) and report unknown; a
			// same-key retry (idempotent) or the invoice.paid webhook heals it.
			return { status: 'unknown', ...nulls, invoiceId };
		}
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

	// Card on file for display. Prefer the explicitly consented card id when
	// given (the one saved at pack checkout); else the customer's default
	// invoice payment method; else the newest attached card. Tolerant — any
	// lookup failure degrades to null (the UI shows "no card on file").
	// Fraud composers note: null therefore means "unknown", not "no card" — a
	// transient provider error is indistinguishable from a cardless customer
	// here, and without a consented id the card resolved is the default/newest,
	// which the customer controls. Treat a missing fingerprint as a missing
	// signal, never as a clean one.
	async getPaymentMethod(opts: {
		customerId: string;
		paymentMethodId?: string | null;
	}): Promise<INormalizedCard | null> {
		const stripe = await this.client();
		const toCard = (pm: { card?: IStripeCardRaw } | null): INormalizedCard | null =>
			pm?.card
				? {
						brand: pm.card.brand,
						last4: pm.card.last4,
						expMonth: pm.card.exp_month,
						expYear: pm.card.exp_year,
						fingerprint: pm.card.fingerprint ?? null,
					}
				: null;
		try {
			if (opts.paymentMethodId) {
				const pm = await stripe.paymentMethods
					.retrieve(opts.paymentMethodId)
					.catch(() => null);
				// Same ownership rule as setDefaultPaymentMethod/detachPaymentMethod,
				// but read-tolerant: a stale stored id (card detached out-of-band —
				// its customer becomes null) falls through to the default/newest
				// branches instead of reporting a card no longer on file.
				if (pm?.customer === opts.customerId) {
					const card = toCard(pm);
					if (card) return card;
				}
			}
			const customer = await stripe.customers.retrieve(opts.customerId).catch(() => null);
			const defaultPm =
				customer && !customer.deleted
					? (customer.invoice_settings?.default_payment_method ?? null)
					: null;
			const defaultPmId = typeof defaultPm === 'string' ? defaultPm : (defaultPm?.id ?? null);
			if (defaultPmId) {
				const pm = await stripe.paymentMethods.retrieve(defaultPmId).catch(() => null);
				const card = toCard(pm);
				if (card) return card;
			}
			const list = await stripe.paymentMethods
				.list({ customer: opts.customerId, type: 'card', limit: 1 })
				.catch(() => null);
			return toCard(list?.data?.[0] ?? null);
		} catch {
			return null;
		}
	}

	// In-app card entry: a SetupIntent the client confirms with the Payment
	// Element. usage:'off_session' so the saved card can back future wallet
	// auto-recharge / renewals. The offered methods come from
	// `options.setupPaymentMethodTypes` (default `['card']`): explicit
	// payment_method_types rather than automatic_payment_methods, because the
	// default of card keeps entry on-page AND avoids wallet methods like Stripe
	// Link — whose confirmed PM is type:'link' with no `card` object, so it can't
	// be shown as a card on file. Consumers who want wallets set the option.
	async createSetupIntent(opts: {
		customerId: string;
	}): Promise<{ clientSecret: string; setupIntentId: string }> {
		const stripe = await this.client();
		const si = await stripe.setupIntents.create({
			customer: opts.customerId,
			usage: 'off_session',
			payment_method_types: this.options.setupPaymentMethodTypes ?? [SUPPORTED_PAYMENT_OPTIONS.CARD],
		});
		return { clientSecret: si.client_secret ?? '', setupIntentId: si.id };
	}

	// Set an attached card as the customer's default. Verifies ownership first —
	// the card must already be attached to THIS customer (the SetupIntent confirm
	// attaches it) — so a caller can't hijack another customer's payment method.
	async setDefaultPaymentMethod(opts: { customerId: string; paymentMethodId: string }): Promise<void> {
		const stripe = await this.client();
		const pm = await stripe.paymentMethods.retrieve(opts.paymentMethodId).catch(() => null);
		if (!pm || pm.customer !== opts.customerId) {
			throw new Error('[billing:stripe] payment method is not attached to this customer');
		}
		await stripe.customers.update(opts.customerId, {
			invoice_settings: { default_payment_method: opts.paymentMethodId },
		});
	}

	// Remove a saved card. Same ownership check; a card already detached/absent is
	// a no-op (idempotent remove).
	async detachPaymentMethod(opts: { customerId: string; paymentMethodId: string }): Promise<void> {
		const stripe = await this.client();
		const pm = await stripe.paymentMethods.retrieve(opts.paymentMethodId).catch(() => null);
		if (!pm) return;
		if (pm.customer !== opts.customerId) {
			throw new Error('[billing:stripe] payment method is not attached to this customer');
		}
		await stripe.paymentMethods.detach(opts.paymentMethodId);
	}

	// The customer's invoices, newest first (Stripe returns them so). Amounts
	// stay in the smallest currency unit; currency is upper-cased to match the
	// wallet/ledger DTO convention.
	async listInvoices(opts: {
		customerId: string;
		limit?: number;
	}): Promise<INormalizedInvoiceSummary[]> {
		const stripe = await this.client();
		const limit = opts.limit ?? 20;

		// Subscription invoices (renewals) — the classic invoice with a number + PDF.
		const invoiceRes = await stripe.invoices.list({ customer: opts.customerId, limit });
		const invoices: INormalizedInvoiceSummary[] = (invoiceRes.data as IStripeInvoiceRaw[]).map(
			(inv) => ({
				id: inv.id,
				number: inv.number ?? null,
				amountDue: BigInt(inv.amount_due ?? 0),
				amountPaid: BigInt(inv.amount_paid ?? 0),
				currency: (inv.currency ?? 'usd').toUpperCase(),
				status: inv.status ?? 'unknown',
				created: new Date((inv.created ?? 0) * 1000).toISOString(),
				dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
				hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
				invoicePdf: inv.invoice_pdf ?? null,
			}),
		);

		// One-time payments (credit-pack purchases) never become Stripe invoices —
		// they are bare charges. Surface them too so the buyer has a record of the
		// money they paid, linkable to Stripe's hosted receipt. Exclude charges that
		// settle a subscription invoice (already listed above) and any that didn't
		// capture, so this is a clean union with no double-counting.
		const chargeRes = await stripe.charges
			.list({ customer: opts.customerId, limit })
			.catch(() => null);
		const oneTime: INormalizedInvoiceSummary[] = ((chargeRes?.data ?? []) as IStripeChargeRaw[])
			.filter((c) => !c.invoice && (c.paid === true || c.status === 'succeeded'))
			.map((c) => ({
				id: c.id,
				number: null, // charges carry no invoice number
				amountDue: BigInt(c.amount ?? 0),
				amountPaid: BigInt(c.amount_captured ?? c.amount ?? 0),
				currency: (c.currency ?? 'usd').toUpperCase(),
				status: c.status === 'succeeded' ? 'paid' : (c.status ?? 'unknown'),
				created: new Date((c.created ?? 0) * 1000).toISOString(),
				dueDate: null, // a one-time charge is paid on capture — no due date
				hostedInvoiceUrl: c.receipt_url ?? null, // Stripe-hosted receipt to view/link
				invoicePdf: null,
			}));

		// Newest first (ISO-8601 sorts lexically), capped to the requested page size.
		return [...invoices, ...oneTime]
			.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0))
			.slice(0, limit);
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

		// Refund / chargeback events — normalized for the payment webhook's
		// wallet clawback. Kept before the subscription gate (below) so they are
		// not swallowed by its type-only pass-through.
		if (raw.type === 'charge.refunded') {
			return {
				type: raw.type,
				subscription: null,
				reversal: normalizeChargeRefund(raw.data.object as IStripeChargeRaw),
			};
		}
		if (raw.type === 'charge.dispute.created' || raw.type === 'charge.dispute.closed') {
			return {
				type: raw.type,
				subscription: null,
				reversal: normalizeDispute(raw.data.object as IStripeDisputeRaw),
			};
		}

		// Subscription invoice events (renewal receipt / dunning) — Phase 3b.
		if (raw.type === 'invoice.paid' || raw.type === 'invoice.payment_failed') {
			const status = raw.type === 'invoice.paid' ? 'paid' : 'payment_failed';
			return {
				type: raw.type,
				subscription: null,
				invoice: normalizeInvoice(raw.data.object as IStripeInvoiceRaw, status),
			};
		}

		// Failed one-time payment ATTEMPTS (delayed-method pack payment, or a
		// declined PaymentIntent) — distinct from a subscription's past_due dunning.
		if (raw.type === 'checkout.session.async_payment_failed') {
			return {
				type: raw.type,
				subscription: null,
				paymentFailure: normalizePaymentFailureFromSession(raw.data.object as IStripeCheckoutSessionRaw),
			};
		}
		// A succeeded bare PaymentIntent — the safety net for an in-app pack purchase
		// whose synchronous credit was lost to an indeterminate response. ONLY our
		// in-app purchases (metadata.reason==='purchase') are surfaced to credit:
		// hosted-checkout PaymentIntents (credited via checkout.session.completed) and
		// auto-recharge PaymentIntents (credited synchronously by maybeAutoRecharge)
		// carry no 'purchase' reason and pass through, so this can never double-credit
		// them. The webhook keys the credit off the PaymentIntent id — the same key
		// the synchronous purchase credit uses — so a normal (already-credited)
		// purchase's success event no-ops.
		if (raw.type === 'payment_intent.succeeded') {
			const pi = raw.data.object as IStripePaymentIntentRaw;
			if (pi.metadata?.reason === 'purchase') {
				return { type: raw.type, subscription: null, payment: normalizePaymentIntentSucceeded(pi) };
			}
			return { type: raw.type, subscription: null };
		}
		if (raw.type === 'payment_intent.payment_failed') {
			return {
				type: raw.type,
				subscription: null,
				paymentFailure: normalizePaymentFailureFromIntent(raw.data.object as IStripePaymentIntentRaw),
			};
		}

		const isSubscriptionEvent = [
			'customer.subscription.created',
			'customer.subscription.updated',
			'customer.subscription.deleted',
			// A trial about to end — carries the subscription; the webhook emits a
			// heads-up notice without mutating state (handled before the upsert).
			'customer.subscription.trial_will_end',
		].includes(raw.type);

		if (!isSubscriptionEvent) {
			return { type: raw.type, subscription: null };
		}

		const sub = raw.data.object as IStripeSubscriptionRaw;
		// Provider event clock — orders the upsert against out-of-order retries.
		const eventAt = typeof raw.created === 'number' ? new Date(raw.created * 1000) : null;

		if (raw.type === 'customer.subscription.deleted') {
			return {
				type: raw.type,
				eventAt,
				subscription: { ...normalizeSubscription(sub), plan: 'free', status: 'canceled' },
			};
		}

		return { type: raw.type, eventAt, subscription: normalizeSubscription(sub) };
	}
}
