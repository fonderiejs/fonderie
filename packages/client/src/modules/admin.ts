import { HttpClient } from '../http';
import type {
	IAdminAttention,
	IAdminConfigReport,
	IAdminDoctorReport,
	IAdminLogPage,
	IAdminManifest,
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
		this.prefix = (opts.prefix ?? '/_admin').replace(/\/+$/, '');
		this.actorHeaders = opts.actor ? { 'X-Actor': opts.actor } : undefined;
	}

	private get<T>(suffix: string) {
		return this.http.request<IApiResponse<T>>({
			method: 'GET',
			path: `${this.prefix}${suffix}`,
			token: this.adminToken,
			headers: this.actorHeaders,
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

	config() {
		return this.get<IAdminConfigReport>('/config');
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
}
