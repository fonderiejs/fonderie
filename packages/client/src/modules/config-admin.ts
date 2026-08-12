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
	ifVersion?: number;
}

export interface ISetSecretInput {
	value: string;
	description?: string;
	ifVersion?: number;
}

export interface IRollbackInput {
	toVersion: number;
}

export interface IConfigAdminClientOptions {
	baseUrl: string;
	adminToken: string;
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

	constructor(opts: IConfigAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
	}

	// ── Config ───────────────────────────────────────────────────────────────

	listConfig(environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry[]>>({
			method: 'GET',
			path: `/admin/config${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	getConfig(key: string, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>({
			method: 'GET',
			path: `/admin/config/${key}${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	setConfig(key: string, input: ISetConfigInput, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>({
			method: 'PUT',
			path: `/admin/config/${key}${envQuery(environment)}`,
			body: input,
			token: this.adminToken,
		});
	}

	deleteConfig(key: string, environment?: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/admin/config/${key}${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	listConfigRevisions(key: string, environment?: string) {
		return this.http.request<IApiResponse<IConfigRevision[]>>({
			method: 'GET',
			path: `/admin/config/${key}/revisions${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	rollbackConfig(key: string, input: IRollbackInput, environment?: string) {
		return this.http.request<IApiResponse<IConfigEntry>>({
			method: 'POST',
			path: `/admin/config/${key}/rollback${envQuery(environment)}`,
			body: input,
			token: this.adminToken,
		});
	}

	// ── Secrets (masked) ─────────────────────────────────────────────────────

	listSecrets(environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry[]>>({
			method: 'GET',
			path: `/admin/secrets${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	getSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>({
			method: 'GET',
			path: `/admin/secrets/${key}${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	setSecret(key: string, input: ISetSecretInput, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>({
			method: 'PUT',
			path: `/admin/secrets/${key}${envQuery(environment)}`,
			body: input,
			token: this.adminToken,
		});
	}

	deleteSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/admin/secrets/${key}${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	listSecretRevisions(key: string, environment?: string) {
		return this.http.request<IApiResponse<ISecretRevision[]>>({
			method: 'GET',
			path: `/admin/secrets/${key}/revisions${envQuery(environment)}`,
			token: this.adminToken,
		});
	}

	rollbackSecret(key: string, input: IRollbackInput, environment?: string) {
		return this.http.request<IApiResponse<ISecretEntry>>({
			method: 'POST',
			path: `/admin/secrets/${key}/rollback${envQuery(environment)}`,
			body: input,
			token: this.adminToken,
		});
	}

	// POST (not GET) so the decrypted value never lands in a URL or access log.
	revealSecret(key: string, environment?: string) {
		return this.http.request<IApiResponse<IRevealSecretResult>>({
			method: 'POST',
			path: `/admin/secrets/${key}/reveal${envQuery(environment)}`,
			token: this.adminToken,
		});
	}
}
