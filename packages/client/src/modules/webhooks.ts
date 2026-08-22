import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IReadOptions,
	IApiResponse,
	ITestWebhookResult,
	IWebhookDeliveryListResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	IWebhookEndpointListResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface ICreateWebhookEndpointInput {
	url: string;
	events?: string[];
}

export interface IUpdateWebhookEndpointInput {
	url?: string;
	events?: string[];
	enabled?: boolean;
}

// ── Webhooks client ──────────────────────────────────────────────────────────

export class WebhooksClient {
	private workspaceId: string | undefined;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// Scopes every request to this workspace (X-Workspace-ID). Falls back to
	// the caller's personal workspace when unset, same as billing/workspaces/audit.
	setWorkspaceId(workspaceId: string | undefined) {
		this.workspaceId = workspaceId;
	}

	listEndpoints(opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWebhookEndpointListResult>>({
			method: 'GET',
			path: '/webhooks',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	// The response includes `secret` — shown once, at creation. There is no
	// way to retrieve it again afterward; store it or let the caller copy it.
	createEndpoint(input: ICreateWebhookEndpointInput) {
		return this.http.request<IApiResponse<IWebhookEndpointCreatedDTO>>({
			method: 'POST',
			path: '/webhooks',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	getEndpoint(endpointId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWebhookEndpointDTO>>({
			method: 'GET',
			path: `/webhooks/${endpointId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateEndpoint(endpointId: string, input: IUpdateWebhookEndpointInput) {
		return this.http.request<IApiResponse<IWebhookEndpointDTO>>({
			method: 'PATCH',
			path: `/webhooks/${endpointId}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteEndpoint(endpointId: string) {
		return this.http.request<undefined>({
			method: 'DELETE',
			path: `/webhooks/${endpointId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	listDeliveries(endpointId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWebhookDeliveryListResult>>({
			method: 'GET',
			path: `/webhooks/${endpointId}/deliveries`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	testEndpoint(endpointId: string) {
		return this.http.request<IApiResponse<ITestWebhookResult>>({
			method: 'POST',
			path: `/webhooks/${endpointId}/test`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
