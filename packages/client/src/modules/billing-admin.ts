import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
import type {
	IAdminCatalog,
	IAdminGrantInput,
	IAdminPlanInput,
	IAdminSubscriptionDTO,
	IAdminSubscriptionPage,
	IAdminWalletDTO,
	IAdminWalletLedgerPage,
	IApiResponse,
	IPlanDTO,
	SubscriberType,
} from '../types';

export interface IBillingAdminClientOptions {
	baseUrl: string;
	adminToken: string;
	// Where AdminModule was mounted, relative to baseUrl. Default '/_admin'.
	prefix?: string;
	// Recorded as X-Actor in the admin log.
	actor?: string;
}

export interface IAdminSubscriptionsQuery {
	limit?: number;
	cursor?: string;
}

export interface IAdminLedgerQuery {
	currency?: string;
	limit?: number;
	cursor?: string;
}

// @fonderie/billing's operator routes, which exist only through @fonderie/admin.
// Deliberately not on FonderieClient: no user session can reach them.
export class BillingAdminClient {
	private http: HttpClient;
	private adminToken: string;
	private prefix: string;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: IBillingAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = normalizeMountPath(opts.prefix ?? '/_admin');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	private call<T>(method: string, suffix: string, body?: unknown) {
		return this.http.request<IApiResponse<T>>({
			method,
			path: `${this.prefix}${suffix}`,
			token: this.adminToken,
			headers: this.actorHeaders,
			...(body !== undefined ? { body } : {}),
		});
	}

	private sub(type: SubscriberType, id: string) {
		return `/${type}/${encodeURIComponent(id)}`;
	}

	catalog() {
		return this.call<IAdminCatalog>('GET', '/catalog');
	}

	createPlan(input: IAdminPlanInput & { name: string }) {
		return this.call<IPlanDTO>('POST', '/plans', input);
	}

	updatePlan(planId: string, input: IAdminPlanInput) {
		return this.call<IPlanDTO>('PUT', `/plans/${encodeURIComponent(planId)}`, input);
	}

	deletePlan(planId: string) {
		return this.call<undefined>('DELETE', `/plans/${encodeURIComponent(planId)}`);
	}

	// A page of subscribers, newest first. The lookup below still answers for a
	// known subscriber; this is for finding one you cannot name.
	listSubscriptions(query: IAdminSubscriptionsQuery = {}) {
		const q = new URLSearchParams();
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		const qs = q.toString();
		return this.call<IAdminSubscriptionPage>('GET', `/subscriptions${qs ? `?${qs}` : ''}`);
	}

	subscription(type: SubscriberType, id: string) {
		return this.call<IAdminSubscriptionDTO>('GET', `/subscriptions${this.sub(type, id)}`);
	}

	wallet(type: SubscriberType, id: string, currency?: string) {
		const qs = currency ? `?currency=${encodeURIComponent(currency)}` : '';
		return this.call<IAdminWalletDTO>('GET', `/wallet${this.sub(type, id)}${qs}`);
	}

	walletLedger(type: SubscriberType, id: string, query: IAdminLedgerQuery = {}) {
		const q = new URLSearchParams();
		if (query.currency) q.set('currency', query.currency);
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		const qs = q.toString();
		return this.call<IAdminWalletLedgerPage>(
			'GET',
			`/wallet${this.sub(type, id)}/ledger${qs ? `?${qs}` : ''}`,
		);
	}

	// Manual credit — an idempotency key is required by the server.
	grant(input: IAdminGrantInput) {
		return this.call<unknown>('POST', '/wallet/grant', input);
	}
}
