import { HttpClient } from '../http';
import type { IApiResponse, ITemplateEntry, ITemplateRevision } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface ISetTemplateInput {
	text: string;
	subject?: string;
	html?: string;
	active?: boolean;
	ifVersion?: number;
}

export interface IRollbackTemplateInput {
	toVersion: number;
}

export interface ICourierAdminClientOptions {
	baseUrl: string;
	adminToken: string;
	// Sent as X-Actor on writes — recorded as updatedBy and in revision
	// history (defaults server-side to 'admin-token').
	actor?: string;
}

// ── Courier admin client ─────────────────────────────────────────────────────
//
// Separate from FonderieClient on purpose: @fonderie/courier's admin routes
// (/admin/templates/*) are guarded by a static bearer token configured on the
// server (CourierModule's adminToken), not the signed-in user's session —
// the same model @fonderie/config's admin surface uses, and the one the
// `fonderie template`/`fonderie config` CLI commands already speak to via
// FONDERIE_ADMIN_URL/FONDERIE_ADMIN_TOKEN. Bundling this into FonderieClient
// would suggest an end-user's session token can reach it, which it can't —
// this is an ops/admin-dashboard client, constructed with its own token.
export class CourierAdminClient {
	private http: HttpClient;
	private adminToken: string;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: ICourierAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	listTemplates() {
		return this.http.request<IApiResponse<ITemplateEntry[]>>({
			method: 'GET',
			path: '/admin/templates',
			token: this.adminToken,
		});
	}

	getTemplate(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>({
			method: 'GET',
			path: `/admin/templates/${type}${q}`,
			token: this.adminToken,
		});
	}

	setTemplate(type: string, input: ISetTemplateInput, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>({
			method: 'PUT',
			path: `/admin/templates/${type}${q}`,
			body: input,
			token: this.adminToken,
			headers: this.actorHeaders,
		});
	}

	deleteTemplate(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/admin/templates/${type}${q}`,
			token: this.adminToken,
			headers: this.actorHeaders,
		});
	}

	listRevisions(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateRevision[]>>({
			method: 'GET',
			path: `/admin/templates/${type}/revisions${q}`,
			token: this.adminToken,
		});
	}

	rollback(type: string, input: IRollbackTemplateInput, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>({
			method: 'POST',
			path: `/admin/templates/${type}/rollback${q}`,
			body: input,
			token: this.adminToken,
			headers: this.actorHeaders,
		});
	}
}
