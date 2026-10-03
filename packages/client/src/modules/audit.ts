import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type { IReadOptions, IApiResponse, IAuditPageResult } from '../types';
import { WorkspaceScope } from '../workspace-scope';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface IListAuditEventsInput {
	type?: string;
	actorId?: string;
	from?: Date;
	to?: Date;
	limit?: number;
	cursor?: string;
}

// ── Audit client ─────────────────────────────────────────────────────────────

export class AuditClient {
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

	// Scopes the audit query to a workspace (X-Workspace-ID). Falls back to
	// the caller's personal workspace when unset, same as billing/workspaces.
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

	listEvents(input: IListAuditEventsInput = {}, opts?: IReadOptions) {
		const params = new URLSearchParams();
		if (input.limit !== undefined) params.set('limit', String(input.limit));
		if (input.type) params.set('type', input.type);
		if (input.actorId) params.set('actorId', input.actorId);
		if (input.from) params.set('from', input.from.toISOString());
		if (input.to) params.set('to', input.to.toISOString());
		if (input.cursor) params.set('cursor', input.cursor);
		const qs = params.toString();

		return this.http.request<IApiResponse<IAuditPageResult>>({
			method: 'GET',
			path: `/audit${qs ? `?${qs}` : ''}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}
}
