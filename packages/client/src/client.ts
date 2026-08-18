import { HttpClient } from './http';
import { AuditClient } from './modules/audit';
import { AuthClient } from './modules/auth';
import { BillingClient } from './modules/billing';
import { CustomersClient } from './modules/customers';
import { WebhooksClient } from './modules/webhooks';
import { WorkspacesClient } from './modules/workspaces';
import { TokenStore } from './token-store';
import type { IApiResponse } from './types';

export interface IFonderieClientOptions {
	baseUrl: string;
	accessToken?: string;
	workspaceId?: string;
}

// Per-call options for the generic transport. `workspaceId` overrides the
// client-level default for a single request.
export interface IRequestConfig {
	workspaceId?: string;
}

export class FonderieClient {
	readonly auth: AuthClient;
	readonly billing: BillingClient;
	readonly workspaces: WorkspacesClient;
	readonly audit: AuditClient;
	readonly webhooks: WebhooksClient;
	readonly customers: CustomersClient;

	private http: HttpClient;
	private tokens: TokenStore;
	private workspaceId: string | undefined;

	constructor(opts: IFonderieClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.tokens = new TokenStore(opts.accessToken);
		this.workspaceId = opts.workspaceId;
		this.auth = new AuthClient(this.http, this.tokens);
		this.billing = new BillingClient(this.http, this.tokens);
		this.workspaces = new WorkspacesClient(this.http, this.tokens);
		this.audit = new AuditClient(this.http, this.tokens);
		this.webhooks = new WebhooksClient(this.http, this.tokens);
		this.customers = new CustomersClient(this.http, this.tokens);
	}

	// The JWT used to authenticate every request — the typed modules and the
	// generic transport share one token store. Pass undefined to sign out.
	setAccessToken(token: string | undefined): void {
		this.tokens.set(token);
	}

	// Default X-Workspace-ID for the generic transport, also propagated to the
	// workspace-scoped modules so one call configures the whole client.
	setWorkspaceId(workspaceId: string | undefined): void {
		this.workspaceId = workspaceId;
		this.billing.setWorkspaceId(workspaceId);
		this.workspaces.setWorkspaceId(workspaceId);
		this.customers.setWorkspaceId(workspaceId);
	}

	// ── Generic transport ──────────────────────────────────────────────────────
	// A Fonderie-aware HTTP client for endpoints outside the typed modules (an
	// app's own routes on the same backend). It attaches the shared JWT and
	// X-Workspace-ID automatically and returns Fonderie's { reason, explanation,
	// result } envelope — so you don't hand-roll auth for custom endpoints.

	request<T = unknown>(opts: {
		method: string;
		path: string;
		body?: unknown;
		workspaceId?: string | undefined;
	}): Promise<IApiResponse<T>> {
		return this.http.request<IApiResponse<T>>({
			method: opts.method,
			path: opts.path,
			body: opts.body,
			token: this.tokens.get(),
			workspaceId: opts.workspaceId ?? this.workspaceId,
		});
	}

	get<T = unknown>(path: string, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({ method: 'GET', path, workspaceId: config?.workspaceId });
	}

	post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({ method: 'POST', path, body, workspaceId: config?.workspaceId });
	}

	put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({ method: 'PUT', path, body, workspaceId: config?.workspaceId });
	}

	patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({ method: 'PATCH', path, body, workspaceId: config?.workspaceId });
	}

	delete<T = unknown>(path: string, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({ method: 'DELETE', path, workspaceId: config?.workspaceId });
	}
}
