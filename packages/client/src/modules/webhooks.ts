import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IDeletedWebhookEndpointDTO,
	IReadOptions,
	IApiResponse,
	ITestWebhookResult,
	IWebhookDeliveryListResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	IWebhookEndpointListResult,
} from '../types';
import { WorkspaceScope } from '../workspace-scope';

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
	// Created on first use, so an instance built without the constructor (a
	// test double from Object.create(prototype)) still works.
	private scope?: WorkspaceScope;

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
		this.workspaceScope().set(workspaceId);
	}

	// The workspace this client is scoped to (X-Workspace-ID).
	getWorkspaceId(): string | undefined {
		return this.workspaceId;
	}

	// Called whenever setWorkspaceId changes the workspace, so a screen showing
	// this workspace's data re-reads on a switch. Returns the unsubscribe.
	onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void {
		return this.workspaceScope().on(listener);
	}

	private workspaceScope(): WorkspaceScope {
		if (!this.scope) this.scope = new WorkspaceScope();
		return this.scope;
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
			path: `/webhooks/${encodeURIComponent(endpointId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateEndpoint(endpointId: string, input: IUpdateWebhookEndpointInput) {
		return this.http.request<IApiResponse<IWebhookEndpointDTO>>({
			method: 'PATCH',
			path: `/webhooks/${encodeURIComponent(endpointId)}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteEndpoint(endpointId: string) {
		return this.http.request<undefined>({
			method: 'DELETE',
			path: `/webhooks/${encodeURIComponent(endpointId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── The undo bin: deleted webhook endpoints, restorable for 30 days ──────────────
	listDeletedWebhookEndpoints(opts?: IReadOptions) {
		return this.http.request<IApiResponse<{ endpoints: IDeletedWebhookEndpointDTO[] }>>({
			method: 'GET',
			path: '/webhooks/bin',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	restoreWebhookEndpoint(id: string) {
		return this.http.request<IApiResponse<IWebhookEndpointDTO>>({
			method: 'POST',
			path: `/webhooks/bin/${encodeURIComponent(id)}/restore`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Gone for good — the workspace owner only.
	purgeDeletedWebhookEndpoint(id: string) {
		return this.http.request<undefined>({
			method: 'DELETE',
			path: `/webhooks/bin/${encodeURIComponent(id)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	listDeliveries(endpointId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<IWebhookDeliveryListResult>>({
			method: 'GET',
			path: `/webhooks/${encodeURIComponent(endpointId)}/deliveries`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	testEndpoint(endpointId: string) {
		return this.http.request<IApiResponse<ITestWebhookResult>>({
			method: 'POST',
			path: `/webhooks/${encodeURIComponent(endpointId)}/test`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
