import { HttpClient } from '../http';
import type {
	IApiResponse,
	IConfigEntry,
	IConfigRevision,
	IRevealSecretResult,
	ISecretEntry,
	ISecretRevision,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface ISetConfigInput {
	value: unknown;
	description?: string;
	// Deactivated entries stay stored but are excluded from runtime reads.
	active?: boolean;
	ifVersion?: number;
}

export interface ISetSecretInput {
	value: string;
	description?: string;
	// Deactivated secrets stay stored but are excluded from runtime reads.
	active?: boolean;
	ifVersion?: number;
}

export interface IRollbackInput {
	toVersion: number;
}

export interface IConfigAdminClientOptions {
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

function envQuery(environment?: string): string {
	return environment ? `?environment=${encodeURIComponent(environment)}` : '';
}

// ── Config admin client ──────────────────────────────────────────────────────
//
// Separate from FonderieClient on purpose, for the same reason as
// CourierAdminClient: @fonderie/config's admin routes (/admin/config/*,
// /admin/secrets/*) are guarded by a static bearer token configured on the
// server, not the signed-in user's session. Construct with that token
// directly; it shares no state with AuthClient/BillingClient/WorkspacesClient.
export class ConfigAdminClient {
	private http: HttpClient;
	private adminToken: string;
	private prefix: string | undefined;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: IConfigAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = opts.prefix?.replace(/\/+$/, '');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	// The path literals stay on the legacy '/admin/...' so the route table and
	// the coverage gate read them; the prefix is applied here at request time.
	private rebase<T extends { path: string }>(opts: T): T {
		if (!this.prefix) return opts;
		return { ...opts, path: opts.path.replace(/^\/admin(?=\/|\?|$)/, this.prefix) };
	}

	// ── Config ───────────────────────────────────────────────────────────────

	listConfig(environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry[]>>(
			this.rebase({
				method: 'GET',
				path: `/admin/config${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	getConfig(key: string, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>(
			this.rebase({
				method: 'GET',
				path: `/admin/config/${encodeURIComponent(key)}${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	setConfig(key: string, input: ISetConfigInput, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>(
			this.rebase({
				method: 'PUT',
				path: `/admin/config/${encodeURIComponent(key)}${envQuery(environment)}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	deleteConfig(key: string, environment?: string) {
		return this.http.request<IApiResponse<undefined>>(
			this.rebase({
				method: 'DELETE',
				path: `/admin/config/${encodeURIComponent(key)}${envQuery(environment)}`,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	listConfigRevisions(key: string, environment?: string) {
		return this.http.request<IApiResponse<IConfigRevision[]>>(
			this.rebase({
				method: 'GET',
				path: `/admin/config/${encodeURIComponent(key)}/revisions${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	rollbackConfig(key: string, input: IRollbackInput, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>(
			this.rebase({
				method: 'POST',
				path: `/admin/config/${encodeURIComponent(key)}/rollback${envQuery(environment)}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	// ── Secrets (masked) ─────────────────────────────────────────────────────

	listSecrets(environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry[]>>(
			this.rebase({
				method: 'GET',
				path: `/admin/secrets${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	getSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>(
			this.rebase({
				method: 'GET',
				path: `/admin/secrets/${encodeURIComponent(key)}${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	setSecret(key: string, input: ISetSecretInput, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>(
			this.rebase({
				method: 'PUT',
				path: `/admin/secrets/${encodeURIComponent(key)}${envQuery(environment)}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	deleteSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<undefined>>(
			this.rebase({
				method: 'DELETE',
				path: `/admin/secrets/${encodeURIComponent(key)}${envQuery(environment)}`,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	listSecretRevisions(key: string, environment?: string) {
		return this.http.request<IApiResponse<ISecretRevision[]>>(
			this.rebase({
				method: 'GET',
				path: `/admin/secrets/${encodeURIComponent(key)}/revisions${envQuery(environment)}`,
				token: this.adminToken,
			}),
		);
	}

	rollbackSecret(key: string, input: IRollbackInput, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>(
			this.rebase({
				method: 'POST',
				path: `/admin/secrets/${encodeURIComponent(key)}/rollback${envQuery(environment)}`,
				body: input,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}

	// POST (not GET) so the decrypted value never lands in a URL or access log.
	revealSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<IRevealSecretResult>>(
			this.rebase({
				method: 'POST',
				path: `/admin/secrets/${encodeURIComponent(key)}/reveal${envQuery(environment)}`,
				token: this.adminToken,
				headers: this.actorHeaders,
			}),
		);
	}
}
