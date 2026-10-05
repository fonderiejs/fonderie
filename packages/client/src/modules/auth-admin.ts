import { HttpClient } from '../http';
import { normalizeMountPath } from '../path';
import type {
	IAdminErasureDTO,
	IAdminErasureExport,
	IAdminErasurePageResult,
	IAdminUserDTO,
	IAdminUserPageResult,
	IApiResponse,
	ILoginHistoryPageResult,
	ISessionDTO,
} from '../types';

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

export interface IAdminErasuresQuery {
	limit?: number;
	cursor?: string;
	// Either one ⇒ the receipt for that person (matched by keyed hash).
	email?: string;
	phone?: string;
}

export interface IAdminUsersQuery {
	limit?: number;
	cursor?: string;
	// true ⇒ only soft-deleted accounts (not yet purged).
	deleted?: boolean;
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
		this.prefix = normalizeMountPath(opts.prefix ?? '/_admin');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	private call<T>(method: string, suffix: string, body?: unknown, base = '/users') {
		return this.http.request<IApiResponse<T>>({
			method,
			path: `${this.prefix}${base}${suffix}`,
			token: this.adminToken,
			headers: this.actorHeaders,
			...(body !== undefined ? { body } : {}),
		});
	}

	// A page of users, newest first. The same route as findUser — with an email
	// it looks one up, without one it lists.
	listUsers(query: IAdminUsersQuery = {}) {
		const q = new URLSearchParams();
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		if (query.deleted) q.set('deleted', '1');
		const qs = q.toString();
		return this.call<IAdminUserPageResult>('GET', qs ? `?${qs}` : '');
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

	// ── Account deletion ────────────────────────────────────────────────────
	// The person asked support to keep their account: active again, billing
	// resumes, and they are told.
	cancelUserDeletion(id: string) {
		return this.call<IAdminUserDTO>('POST', `/${encodeURIComponent(id)}/deletion/cancel`);
	}

	// A legal hold: the schedule neither reminds nor erases until it is lifted.
	holdUserDeletion(id: string, reason: string) {
		return this.call<IAdminUserDTO>('POST', `/${encodeURIComponent(id)}/deletion/hold`, { reason });
	}

	liftUserDeletionHold(id: string) {
		return this.call<IAdminUserDTO>('DELETE', `/${encodeURIComponent(id)}/deletion/hold`);
	}

	// Erase an archived account now (an urgent, verified request). Answers the receipt.
	eraseUserNow(id: string) {
		return this.call<IAdminErasureDTO>('DELETE', `/${encodeURIComponent(id)}/deletion`);
	}

	// Erasure receipts, newest first — or the one for an email / phone.
	listErasures(query: IAdminErasuresQuery = {}) {
		const q = new URLSearchParams();
		if (query.limit) q.set('limit', String(query.limit));
		if (query.cursor) q.set('cursor', query.cursor);
		if (query.email) q.set('email', query.email);
		if (query.phone) q.set('phone', query.phone);
		const qs = q.toString();
		return this.call<IAdminErasurePageResult>('GET', qs ? `?${qs}` : '', undefined, '/erasures');
	}

	// Every receipt, for the auditor's evidence folder.
	exportErasures() {
		return this.call<IAdminErasureExport>('GET', '/export', undefined, '/erasures');
	}
}
