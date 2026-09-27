import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
import type {
	AdminScope,
	IAdminAttention,
	IAdminCreatedLink,
	IAdminEnrollment,
	IAdminOperator,
	IAdminOperatorsReport,
	IAdminSecondFactor,
	IAdminSession,
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
	// A token (machines, the CLI). Omit it in a browser signed in as an
	// operator: the session cookie authenticates instead.
	adminToken?: string;
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
	private adminToken: string | undefined;
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
	// ── operator sign-in (the served console's gate) ──────────────────────
	// Cookie-based: the server sets an HttpOnly session cookie; nothing here
	// ever holds it. Omit adminToken on this client — except for claim().

	/** Who is signed in, and whether the console can still be claimed. */
	session() {
		return this.get<IAdminSession>('/session');
	}

	/** The one-time claim. Needs the ROOT token as this client's adminToken. */
	claim(input: { email: string; password: string; name?: string }) {
		return this.call<IAdminSession>('POST', '/session/claim', input);
	}

	login(input: { email: string; password: string }) {
		return this.call<IAdminSession>('POST', '/session/login', input);
	}

	/** The authenticator secret and otpauth URI to scan while enrolling. */
	enrollment() {
		return this.get<IAdminEnrollment>('/session/enrollment');
	}

	/** Confirms the first code. The response carries the backup codes, once. */
	confirmEnrollment(code: string) {
		return this.call<IAdminSession>('POST', '/session/enrollment', { code });
	}

	/** The second factor after the password: an authenticator code or a backup code. */
	verify(factor: IAdminSecondFactor) {
		return this.call<IAdminSession>('POST', '/session/verify', factor);
	}

	/** A fresh code for the next five minutes of dangerous actions. */
	stepUp(factor: IAdminSecondFactor) {
		return this.call<{ stepUpFresh: boolean; backupCodesLeft?: number }>(
			'POST',
			'/session/step-up',
			factor,
		);
	}

	logout() {
		return this.call<undefined>('DELETE', '/session');
	}

	/** What an invite or recovery link is for, before setting a password. */
	inspectLink(token: string) {
		return this.call<{ kind: 'invite' | 'recovery'; email: string }>(
			'POST',
			'/session/link/inspect',
			{ token },
		);
	}

	redeemLink(input: { token: string; password: string; name?: string }) {
		return this.call<IAdminSession>('POST', '/session/link', input);
	}

	// ── managing operators ─────────────────────────────────────────────────

	operators() {
		return this.get<IAdminOperatorsReport>('/access/operators');
	}

	/** An invite link, shown once. Needs the highest scope and a fresh code. */
	inviteOperator(input: { email: string; scopes: AdminScope[]; expiresInHours?: number }) {
		return this.call<IAdminCreatedLink>('POST', '/access/operators/invites', input);
	}

	/** Lost password or authenticator: a single-use link; signs them out everywhere. */
	recoverOperator(id: string) {
		return this.call<IAdminCreatedLink>(
			'POST',
			`/access/operators/${encodeURIComponent(id)}/recovery`,
		);
	}

	updateOperator(id: string, input: { scopes?: AdminScope[]; name?: string; disabled?: boolean }) {
		return this.call<IAdminOperator>('PUT', `/access/operators/${encodeURIComponent(id)}`, input);
	}

	revokeOperatorLink(id: string) {
		return this.call<undefined>('DELETE', `/access/operators/links/${encodeURIComponent(id)}`);
	}
}
