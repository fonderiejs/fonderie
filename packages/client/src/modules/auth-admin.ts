import { HttpClient } from '../http';
import type { IAdminUserDTO, IApiResponse, ILoginHistoryPageResult, ISessionDTO } from '../types';

export interface IAuthAdminClientOptions {
	baseUrl: string;
	adminToken: string;
	// Where AdminModule was mounted, relative to baseUrl. Default '/_admin'.
	prefix?: string;
	// Recorded as X-Actor in the admin log.
	actor?: string;
}

export interface IAdminLoginHistoryQuery {
	limit?: number;
	cursor?: string;
}

// @fonderie/auth's operator routes, which exist only through @fonderie/admin.
// Deliberately not on FonderieClient: no user session can reach them.
export class AuthAdminClient {
	private http: HttpClient;
	private adminToken: string;
	private prefix: string;
	private actorHeaders: Record<string, string> | undefined;

	constructor(opts: IAuthAdminClientOptions) {
		this.http = new HttpClient(opts.baseUrl);
		this.adminToken = opts.adminToken;
		this.prefix = (opts.prefix ?? '/_admin').replace(/\/+$/, '');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	private call<T>(method: string, suffix: string) {
		return this.http.request<IApiResponse<T>>({
			method,
			path: `${this.prefix}/users${suffix}`,
			token: this.adminToken,
			headers: this.actorHeaders,
		});
	}

	findUser(email: string) {
		return this.call<IAdminUserDTO>('GET', `?email=${encodeURIComponent(email)}`);
	}

	getUser(id: string) {
		return this.call<IAdminUserDTO>('GET', `/${encodeURIComponent(id)}`);
	}

	listUserSessions(id: string) {
		return this.call<ISessionDTO[]>('GET', `/${encodeURIComponent(id)}/sessions`);
	}

	// Signs the user out everywhere.
	revokeUserSessions(id: string) {
		return this.call<undefined>('DELETE', `/${encodeURIComponent(id)}/sessions`);
	}

	userLoginHistory(id: string, query: IAdminLoginHistoryQuery = {}) {
		const q = new URLSearchParams();
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		const qs = q.toString();
		return this.call<ILoginHistoryPageResult>(
			'GET',
			`/${encodeURIComponent(id)}/login-history${qs ? `?${qs}` : ''}`,
		);
	}

	suspendUser(id: string) {
		return this.call<IAdminUserDTO>('POST', `/${encodeURIComponent(id)}/suspend`);
	}

	unsuspendUser(id: string) {
		return this.call<IAdminUserDTO>('POST', `/${encodeURIComponent(id)}/unsuspend`);
	}
}
