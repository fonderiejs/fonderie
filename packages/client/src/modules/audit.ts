import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type { IApiResponse, IAuditPageResult } from '../types';

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
	}

	listEvents(input: IListAuditEventsInput = {}) {
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
		});
	}
}
