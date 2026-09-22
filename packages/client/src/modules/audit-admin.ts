import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
import type { IApiResponse, IAuditPageResult } from '../types';

export interface IAuditAdminClientOptions {
	baseUrl: string;
	adminToken: string;
	// Where AdminModule was mounted, relative to baseUrl. Default '/_admin'.
	prefix?: string;
	// Recorded as X-Actor in the admin log.
	actor?: string;
}

// The workspace-scoped filters, plus the workspace itself as a filter.
export interface IAdminAuditQuery {
	workspaceId?: string;
	type?: string;
	actorId?: string;
	from?: Date;
	to?: Date;
	limit?: number;
	cursor?: string;
}

// @fonderie/audit's operator read, which exists only through @fonderie/admin.
export class AuditAdminClient {
	private http: HttpClient;
	private adminToken: string;
	private prefix: string;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: IAuditAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = normalizeMountPath(opts.prefix ?? '/_admin');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	// Every workspace unless one is named. Newest first, keyset-paged.
	listAudit(query: IAdminAuditQuery = {}) {
		const q = new URLSearchParams();
		if (query.workspaceId) q.set('workspaceId', query.workspaceId);
		if (query.type) q.set('type', query.type);
		if (query.actorId) q.set('actorId', query.actorId);
		if (query.from) q.set('from', query.from.toISOString());
		if (query.to) q.set('to', query.to.toISOString());
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		const qs = q.toString();
		return this.http.request<IApiResponse<IAuditPageResult>>({
			method: 'GET',
			path: `${this.prefix}/audit${qs ? `?${qs}` : ''}`,
			token: this.adminToken,
			headers: this.actorHeaders,
		});
	}
}
