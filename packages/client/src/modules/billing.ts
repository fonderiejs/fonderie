import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IApiResponse,
	ICheckoutUrlResult,
	IPlanListResult,
	IPlanResult,
	IPortalUrlResult,
	ISubscriptionResult,
	IUsageResult,
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

	listPlans() {
		return this.http.request<IApiResponse<IPlanListResult>>({
			method: 'GET',
			path: '/plans',
		});
	}

	getPlan(planId: string) {
		return this.http.request<IApiResponse<IPlanResult>>({
			method: 'GET',
			path: `/plans/${planId}`,
		});
	}

	// ── Subscription ─────────────────────────────────────────────────────────────

	getSubscription() {
		return this.http.request<IApiResponse<ISubscriptionResult>>({
			method: 'GET',
			path: '/billing/subscription',
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

	getUsage(metric: string) {
		return this.http.request<IApiResponse<IUsageResult>>({
			method: 'GET',
			path: `/billing/usage/${metric}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
