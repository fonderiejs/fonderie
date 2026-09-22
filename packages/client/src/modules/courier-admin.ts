import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
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
	// Where the composed surface lives when @fonderie/admin mounts this brick's
	// routes — '/_admin' replaces the leading '/admin' of every path. Unset ⇒
	// the brick's own standalone routes under '/admin'.
	prefix?: string;
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
	private prefix: string | undefined;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: ICourierAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = opts.prefix ? normalizeMountPath(opts.prefix) : undefined;
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	// The path literals stay on the legacy '/admin/...' so the route table and
	// the coverage gate read them; the prefix is applied here at request time.
	private rebase<T extends { path: string }>(opts: T): T {
		if (!this.prefix) return opts;
		return { ...opts, path: opts.path.replace(/^\/admin(?=\/|\?|$)/, this.prefix) };
	}

	listTemplates() {
		return this.http.request<IApiResponse<ITemplateEntry[]>>(
			this.rebase({
				method: 'GET',
				path: '/admin/templates',
				token: this.adminToken,
			}),
		);
	}

	getTemplate(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>(
			this.rebase({
				method: 'GET',
				path: `/admin/templates/${encodeURIComponent(type)}${q}`,
				token: this.adminToken,
			}),
		);
	}

	setTemplate(type: string, input: ISetTemplateInput, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>(
			this.rebase({
				method: 'PUT',
				path: `/admin/templates/${encodeURIComponent(type)}${q}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	deleteTemplate(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<undefined>>(
			this.rebase({
				method: 'DELETE',
				path: `/admin/templates/${encodeURIComponent(type)}${q}`,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	listRevisions(type: string, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateRevision[]>>(
			this.rebase({
				method: 'GET',
				path: `/admin/templates/${encodeURIComponent(type)}/revisions${q}`,
				token: this.adminToken,
			}),
		);
	}

	rollback(type: string, input: IRollbackTemplateInput, locale?: string | null) {
		const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
		return this.http.request<IApiResponse<ITemplateEntry>>(
			this.rebase({
				method: 'POST',
				path: `/admin/templates/${encodeURIComponent(type)}/rollback${q}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}
}
