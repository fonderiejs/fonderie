import type { ICache } from './cache';
import type { IApiError } from './types';

export class FonderieApiError extends Error {
	constructor(
		public readonly reason: string,
		public readonly explanation: string,
		public readonly status: number,
		public readonly details?: unknown,
		// The X-Request-ID for the failed call — quote it in a bug report; it
		// correlates to the server's logs and audit trail for the same request.
		public readonly requestId?: string,
	) {
		super(explanation);
		this.name = 'FonderieApiError';
	}
}

// Portable random hex for W3C trace ids — crypto.getRandomValues where available
// (browser / Node), Math.random fallback for Hermes / older React Native. Not
// security-sensitive: these are correlation/trace ids, not secrets.
function randHex(bytes: number): string {
	const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
	const arr = new Uint8Array(bytes);
	if (c?.getRandomValues) c.getRandomValues(arr);
	else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
	let out = '';
	for (const b of arr) out += b.toString(16).padStart(2, '0');
	return out;
}

export interface IRequestOptions {
	method: string;
	path: string;
	body?: unknown;
	token?: string | undefined;
	cookie?: string | undefined;
	// Resolves the billing subscriber to a workspace (@fonderie/billing's
	// resolveSubscriber falls back to the session user when omitted).
	workspaceId?: string | undefined;
	// Extra request headers (e.g. the admin surfaces' X-Actor attribution).
	headers?: Record<string, string> | undefined;
	// Cache control (only applies when the client was given a cache):
	//   cache: number  → cache this GET for that many ms
	//   cache: false   → skip the cache for this GET
	//   bust: true     → ignore any cached value and refresh it
	//   invalidate     → extra key fragments to evict after a successful write
	cache?: number | false | undefined;
	bust?: boolean | undefined;
	invalidate?: string[] | undefined;
}

export interface IHttpDeps {
	cache?: ICache | undefined;
	defaultTtlMs?: number | undefined;
	// Called once on a 401 (except for /auth/* requests). Returns a fresh access
	// token to retry with, or undefined to let the 401 surface. Callers should
	// make this single-flight.
	refresh?: (() => Promise<string | undefined>) | undefined;
}

export class HttpClient {
	private cache: ICache | undefined;
	private defaultTtlMs: number;
	private refresh: (() => Promise<string | undefined>) | undefined;

	constructor(
		private baseUrl: string,
		deps: IHttpDeps = {},
	) {
		this.cache = deps.cache;
		this.defaultTtlMs = deps.defaultTtlMs ?? 60_000;
		this.refresh = deps.refresh;
	}

	// Absolute URL for a path on this client's origin — for endpoints a browser
	// navigates to or embeds (e.g. a public `<img src>`) rather than fetches
	// through request(). Mirrors the `${baseUrl}${path}` join request() uses.
	absolute(path: string): string {
		return `${this.baseUrl}${path}`;
	}

	// Drop all cached responses — sign-out must not leave one session's data
	// servable to the next.
	clearCache(): void {
		this.cache?.clear();
	}

	async request<T>(opts: IRequestOptions): Promise<T> {
		const method = opts.method.toUpperCase();

		const cache = this.cache;

		// ── Read path: serve/populate cache (GET only, opt-in) ──────────────────
		if (cache && method === 'GET' && opts.cache !== false) {
			const key = `GET ${opts.path}::ws=${opts.workspaceId ?? ''}`;
			if (!opts.bust) {
				const hit = cache.get<T>(key);
				if (hit !== undefined) return hit;
			}
			const ttl = typeof opts.cache === 'number' ? opts.cache : this.defaultTtlMs;
			return cache.dedupe(key, async () => {
				const data = await this.exec<T>(opts);
				cache.set(key, data, ttl);
				return data;
			});
		}

		const data = await this.exec<T>(opts);

		// ── Write path: bust the reads this mutation affects ────────────────────
		if (cache && method !== 'GET') {
			const resource = opts.path.split('?')[0]?.split('/').filter(Boolean)[0];
			if (resource) cache.invalidate(`/${resource}`);
			for (const fragment of opts.invalidate ?? []) cache.invalidate(fragment);
		}

		return data;
	}

	private async exec<T>(opts: IRequestOptions, retried = false): Promise<T> {
		// Start a W3C trace: the trace id doubles as the quotable correlation id
		// (sent as X-Request-ID and surfaced on FonderieApiError.requestId).
		const traceId = randHex(16);
		const requestId = traceId;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			traceparent: `00-${traceId}-${randHex(8)}-01`,
			'X-Request-ID': requestId,
		};
		if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
		if (opts.cookie) headers['Cookie'] = opts.cookie;
		if (opts.workspaceId) headers['X-Workspace-ID'] = opts.workspaceId;
		Object.assign(headers, opts.headers ?? {});

		const fetchInit: RequestInit = { method: opts.method, headers, credentials: 'include' };
		if (opts.body !== undefined) fetchInit.body = JSON.stringify(opts.body);

		const res = await fetch(`${this.baseUrl}${opts.path}`, fetchInit);
		// The server echoes the id back; prefer it (an intermediary could rewrite
		// the one we sent), else fall back to what we generated.
		const rid = res.headers.get('x-request-id') ?? requestId;

		// Reactive renew: on a 401, refresh once and retry (never for /auth/* to
		// avoid recursing through the refresh/login endpoints themselves).
		if (res.status === 401 && this.refresh && !retried && !opts.path.startsWith('/auth/')) {
			const newToken = await this.refresh();
			if (newToken) return this.exec<T>({ ...opts, token: newToken }, true);
		}

		// 204 No Content (e.g. some DELETE routes) has no body to parse.
		if (res.status === 204) {
			if (!res.ok) throw new FonderieApiError('unknown', res.statusText, res.status, undefined, rid);
			return undefined as T;
		}

		const data = (await res.json()) as T | IApiError;

		if (!res.ok || res.status === 202) {
			const err = data as IApiError;
			throw new FonderieApiError(err.reason, err.explanation, res.status, err.details, rid);
		}

		return data as T;
	}
}
