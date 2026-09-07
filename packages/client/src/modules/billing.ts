import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IReadOptions,
	IApiResponse,
	ICancelSubscriptionInput,
	ICheckoutUrlResult,
	IInvoicesResult,
	IPaymentMethodResult,
	IPlanListResult,
	IPlanResult,
	IPortalUrlResult,
	ISavePaymentMethodInput,
	ISetupIntentResult,
	ISubscriptionChangeResult,
	ISubscriptionResult,
	IUsageResult,
	IWalletCheckoutInput,
	IWalletPurchaseInput,
	IWalletPurchaseResult,
	IWalletResult,
	IWalletTransactionsResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface ICheckoutInput {
	plan: string;
	interval?: 'month' | 'year';
}

export interface IRecordUsageInput {
	metric: string;
	quantity?: number;
}

export interface IWalletPreferencesInput {
	// When false, a debit stops at the free allowance (402) rather than drawing
	// down purchased credits.
	spendPurchased: boolean;
}

export interface ICreatePlanInput {
	name: string;
	description?: string | null;
	tier?: number;
	seats?: number | null;
	trialDays?: number;
	monthlyAmount?: number | null;
	monthlyPriceId?: string | null;
	yearlyAmount?: number | null;
	yearlyPriceId?: string | null;
	features?: unknown;
	metadata?: unknown;
}

export type IUpdatePlanInput = Partial<ICreatePlanInput>;

// ── Billing client ───────────────────────────────────────────────────────────

export class BillingClient {
	private workspaceId: string | undefined;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// Subscriber is resolved from this workspace ID (X-Workspace-ID) when set,
	// falling back to the session user otherwise — see @fonderie/billing's
	// resolveSubscriber. Call with undefined to bill the signed-in user directly.
	setWorkspaceId(workspaceId: string | undefined) {
		this.workspaceId = workspaceId;
	}

	// ── Plans — public read-only ────────────────────────────────────────────────

	listPlans(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IPlanListResult>>({
			method: 'GET',
			path: '/plans',
			bust: opts?.bust,
		});
	}

	getPlan(planId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IPlanResult>>({
			method: 'GET',
			path: `/plans/${planId}`,
			bust: opts?.bust,
		});
	}

	// ── Plans — admin write ──────────────────────────────────────────────────────
	// Unlike every other write in this client, @fonderie/billing does not gate
	// these with requireAuth or an admin token — "the caller is responsible for
	// authorization" (its own routes.ts comment). Sending the session token is
	// harmless (the server ignores it) but does nothing on its own; gate access
	// to these calls yourself (an app-level route guard, a reverse-proxy admin
	// zone, or similar) before wiring them into a UI.

	createPlan(input: ICreatePlanInput) {
		return this.http.request<IApiResponse<IPlanResult>>({
			method: 'POST',
			path: '/plans',
			body: input,
			token: this.tokens.get(),
		});
	}

	updatePlan(planId: string, input: IUpdatePlanInput) {
		return this.http.request<IApiResponse<IPlanResult>>({
			method: 'PUT',
			path: `/plans/${planId}`,
			body: input,
			token: this.tokens.get(),
		});
	}

	deletePlan(planId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/plans/${planId}`,
			token: this.tokens.get(),
		});
	}

	// ── Subscription ─────────────────────────────────────────────────────────────

	getSubscription(opts?: IReadOptions) {
		return this.http.request<IApiResponse<ISubscriptionResult>>({
			method: 'GET',
			path: '/billing/subscription',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// First-party cancel — no portal round-trip. Default keeps access until the
	// paid-through date; pass { atPeriodEnd: false } to end it immediately. 501
	// when the provider has no first-party cancel (the portal remains a fallback).
	cancelSubscription(input?: ICancelSubscriptionInput) {
		return this.http.request<IApiResponse<ISubscriptionChangeResult>>({
			method: 'POST',
			path: '/billing/subscription/cancel',
			body: input ?? {},
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Un-cancel a subscription scheduled to cancel at period end. Idempotent; 409
	// when the subscription is already fully canceled (start a new checkout).
	reactivateSubscription() {
		return this.http.request<IApiResponse<ISubscriptionChangeResult>>({
			method: 'POST',
			path: '/billing/subscription/reactivate',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Checkout / portal ────────────────────────────────────────────────────────

	createCheckoutSession(input: ICheckoutInput) {
		return this.http.request<IApiResponse<ICheckoutUrlResult>>({
			method: 'POST',
			path: '/billing/checkout',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	createPortalSession() {
		return this.http.request<IApiResponse<IPortalUrlResult>>({
			method: 'POST',
			path: '/billing/portal',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Usage ────────────────────────────────────────────────────────────────────

	recordUsage(input: IRecordUsageInput) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: '/billing/usage',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getUsage(metric: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IUsageResult>>({
			method: 'GET',
			path: `/billing/usage/${metric}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// ── Wallet ─────────────────────────────────────────────────────────────────────

	getWallet(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWalletResult>>({
			method: 'GET',
			path: '/billing/wallet',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	setWalletPreferences(input: IWalletPreferencesInput) {
		return this.http.request<IApiResponse<IWalletResult>>({
			method: 'POST',
			path: '/billing/wallet/preferences',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Start a one-time credit-pack purchase. Returns a hosted checkout URL to
	// redirect the buyer to; the wallet is credited by the payment webhook.
	createWalletCheckout(input: IWalletCheckoutInput) {
		return this.http.request<IApiResponse<ICheckoutUrlResult>>({
			method: 'POST',
			path: '/billing/wallet/checkout',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Buy a credit pack in-app by charging the saved card — no redirect. Inspect
	// `result.status`: 'credited' (done — refresh the wallet), 'checkout_required'
	// (no saved card or the card needs 3-D Secure → fall back to
	// createWalletCheckout), 'declined', or 'processing' (indeterminate — retry
	// with the SAME idempotencyKey). Generate one idempotencyKey per attempt and
	// reuse it on retry so a double-submit can't double-charge.
	purchaseWalletPack(input: IWalletPurchaseInput) {
		return this.http.request<IApiResponse<IWalletPurchaseResult>>({
			method: 'POST',
			path: '/billing/wallet/purchase',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// The wallet ledger, newest first — every credit/debit with a running
	// balanceAfter. Cursor-paginated: pass the previous result's `nextCursor`.
	getWalletTransactions(opts?: IReadOptions & { cursor?: string; limit?: number }) {
		const params = new URLSearchParams();
		if (opts?.cursor) params.set('cursor', opts.cursor);
		if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
		const qs = params.toString();
		return this.http.request<IApiResponse<IWalletTransactionsResult>>({
			method: 'GET',
			path: `/billing/wallet/transactions${qs ? '?' + qs : ''}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// ── Account ──────────────────────────────────────────────────────────────────

	// The customer's card on file (brand/last4/expiry), or { paymentMethod: null }
	// when none is stored. 501 when the provider can't retrieve it.
	getPaymentMethod(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IPaymentMethodResult>>({
			method: 'GET',
			path: '/billing/payment-method',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// Begin in-app card entry — returns a SetupIntent client secret for the
	// provider's embedded card element (Stripe Payment Element); the user never
	// leaves the site. 501 when the provider has no in-app card support.
	setupPaymentMethod() {
		return this.http.request<IApiResponse<ISetupIntentResult>>({
			method: 'POST',
			path: '/billing/payment-method/setup',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Save the card after the client confirms the SetupIntent: makes it the
	// default and records it. 422 when the card isn't attached to this customer.
	savePaymentMethod(input: ISavePaymentMethodInput) {
		return this.http.request<IApiResponse<IPaymentMethodResult>>({
			method: 'PUT',
			path: '/billing/payment-method',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Remove the saved card (detach at the provider + clear the record).
	removePaymentMethod() {
		return this.http.request<IApiResponse<IPaymentMethodResult>>({
			method: 'DELETE',
			path: '/billing/payment-method',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// The customer's invoices, newest first — each links out to the hosted
	// invoice / PDF. 501 when the provider can't list them.
	listInvoices(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IInvoicesResult>>({
			method: 'GET',
			path: '/billing/invoices',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}
}
