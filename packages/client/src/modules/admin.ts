import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
import type {
	IAdminAttention,
	IAdminEnvironmentReport,
	IAdminDoctorReport,
	IAdminIssuedToken,
	IAdminIssueTokenInput,
	IAdminLogPage,
	IAdminManifest,
	IAdminMigrationModule,
	IAdminMigrationsReport,
	IAdminRoutesReport,
	IAdminTokensReport,
	IApiResponse,
} from '../types';

export interface IAdminClientOptions {
	baseUrl: string;
	adminToken: string;
	// Where AdminModule was mounted, relative to baseUrl. Default '/_admin'.
	prefix?: string;
	// Recorded as X-Actor in the admin log.
	actor?: string;
}

export interface IAdminLogQuery {
	limit?: number;
	before?: string;
}

// Deliberately not on FonderieClient: no user session can reach this surface.
export class AdminClient {
	private http: HttpClient;
	private adminToken: string;
	private prefix: string;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: IAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = normalizeMountPath(opts.prefix ?? '/_admin');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	private get<T>(suffix: string) {
		return this.call<T>('GET', suffix);
	}

	private call<T>(method: string, suffix: string, body?: unknown) {
		return this.http.request<IApiResponse<T>>({
			method,
			path: `${this.prefix}${suffix}`,
			token: this.adminToken,
			headers: this.actorHeaders,
			...(body !== undefined ? { body } : {}),
		});
	}

	attention() {
		return this.get<IAdminAttention>('');
	}

	manifest() {
		return this.get<IAdminManifest>('/manifest');
	}

	doctor() {
		return this.get<IAdminDoctorReport>('/doctor');
	}

	environment() {
		return this.get<IAdminEnvironmentReport>('/environment');
	}

	routes() {
		return this.get<IAdminRoutesReport>('/routes');
	}

	tokens() {
		return this.get<IAdminTokensReport>('/access/tokens');
	}

	adminLog(query: IAdminLogQuery = {}) {
		const q = new URLSearchParams();
		if (query.limit) q.set('limit', String(query.limit));
		if (query.before) q.set('before', query.before);
		const qs = q.toString();
		return this.get<IAdminLogPage>(`/activity/admin-log${qs ? `?${qs}` : ''}`);
	}

	// Root token only. The plaintext comes back once.
	issueToken(input: IAdminIssueTokenInput) {
		return this.call<IAdminIssuedToken>('POST', '/access/tokens', input);
	}

	// Root token only.
	revokeToken(id: string) {
		return this.call<undefined>('DELETE', `/access/tokens/${encodeURIComponent(id)}`);
	}

	// What each module is waiting on, with every pending file's impact. Empty
	// when the deployment did not hand its migration sequence to the surface.
	migrations() {
		return this.get<IAdminMigrationsReport>('/migrations');
	}

	/**
	 * Apply one module's pending migrations — all of them, or none.
	 *
	 * `expect` is the pending list you were shown, in order. If it no longer
	 * matches, the server refuses with 409 MIGRATIONS_CHANGED rather than
	 * applying something nobody reviewed. Also refuses 409 when an earlier
	 * module is behind, and 422 when any pending file deletes data.
	 */
	applyMigrations(module: string, expect: readonly string[]) {
		return this.call<IAdminMigrationModule>(
			'POST',
			`/migrations/${encodeURIComponent(module)}/apply`,
			{ expect },
		);
	}
}
