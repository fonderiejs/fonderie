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
