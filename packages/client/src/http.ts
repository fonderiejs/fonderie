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
	// Without a per-call `cache`, the response's Cache-Control decides — the
	// endpoint knows how volatile its data is (no-store → not cached,
	// max-age=N → N seconds) — and only then the client's default TTL.
	cache?: number | false | undefined;
	bust?: boolean | undefined;
	invalidate?: string[] | undefined;
}

/**
 * Whether an error is the server refusing the session (400/401/403 from the
 * auth endpoints) — the only failure that should sign a user out. A network
 * error, a 5xx or a rate limit says nothing about the session: keep it.
 */
export function isSessionRefusal(err: unknown): err is FonderieApiError {
	return err instanceof FonderieApiError && (err.status === 400 || err.status === 401 || err.status === 403);
}

export interface IHttpDeps {
	cache?: ICache | undefined;
	defaultTtlMs?: number | undefined;
	// Called once on a 401 (except for /auth/* requests). Returns a fresh access
	// token to retry with, or undefined to let the 401 surface. Callers should
	// make this single-flight.
	refresh?: (() => Promise<string | undefined>) | undefined;
	// The platform this client runs on, sent as X-Client-Kind so a sign-in gets
	// that platform's session lifetimes (mobile | desktop | web).
	clientKind?: 'mobile' | 'desktop' | 'web' | undefined;
	// Whether the server answered: true for any response (an error status
	// included), false when the request never reached it (network down, DNS,
	// connection refused). Drives the client's 'offline' session state.
	onReachability?: ((reachable: boolean) => void) | undefined;
}

export class HttpClient {
	private clientKind: 'mobile' | 'desktop' | 'web' | undefined;
	private cache: ICache | undefined;
	private defaultTtlMs: number;
	private refresh: (() => Promise<string | undefined>) | undefined;
	private onReachability: ((reachable: boolean) => void) | undefined;

	constructor(
		private baseUrl: string,
		deps: IHttpDeps = {},
	) {
		this.cache = deps.cache;
		this.clientKind = deps.clientKind;
		this.defaultTtlMs = deps.defaultTtlMs ?? 60_000;
		this.refresh = deps.refresh;
		this.onReachability = deps.onReachability;
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
			return cache.dedupe(key, async () => {
				const { data, cacheControl } = await this.execWithMeta<T>(opts);
				const ttl = typeof opts.cache === 'number' ? opts.cache : ttlFromCacheControl(cacheControl) ?? this.defaultTtlMs;
				if (ttl > 0) cache.set(key, data, ttl);
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

	private async exec<T>(opts: IRequestOptions): Promise<T> {
		return (await this.execWithMeta<T>(opts)).data;
	}

	private async execWithMeta<T>(opts: IRequestOptions, retried = false): Promise<{ data: T; cacheControl: string | null }> {
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
		if (this.clientKind) headers['X-Client-Kind'] = this.clientKind;
		Object.assign(headers, opts.headers ?? {});

		const fetchInit: RequestInit = { method: opts.method, headers, credentials: 'include' };
		if (opts.body !== undefined) fetchInit.body = JSON.stringify(opts.body);

		let res: Response;
		try {
			res = await fetch(`${this.baseUrl}${opts.path}`, fetchInit);
		} catch (err) {
			this.onReachability?.(false);
			throw err;
		}
		this.onReachability?.(true);
		// The server echoes the id back; prefer it (an intermediary could rewrite
		// the one we sent), else fall back to what we generated.
		const rid = res.headers.get('x-request-id') ?? requestId;

		// Reactive renew: on a 401, refresh once and retry (never for /auth/* to
		// avoid recursing through the refresh/login endpoints themselves).
		if (res.status === 401 && this.refresh && !retried && !opts.path.startsWith('/auth/')) {
			const newToken = await this.refresh();
			if (newToken) return this.execWithMeta<T>({ ...opts, token: newToken }, true);
		}

		// 204 No Content (e.g. some DELETE routes) has no body to parse.
		if (res.status === 204) {
			if (!res.ok)
				throw new FonderieApiError('unknown', res.statusText, res.status, undefined, rid);
			return { data: undefined as T, cacheControl: res.headers.get('cache-control') };
		}

		const data = (await res.json()) as T | IApiError;

		if (!res.ok || res.status === 202) {
			const err = data as IApiError;
			throw new FonderieApiError(err.reason, err.explanation, res.status, err.details, rid);
		}

		return { data: data as T, cacheControl: res.headers.get('cache-control') };
	}
}

/**
 * How long a response may be reused, from its Cache-Control: 0 for no-store /
 * no-cache (never reuse), max-age=N → N seconds, undefined when the header says
 * nothing about it (the client's default applies).
 */
export function ttlFromCacheControl(header: string | null | undefined): number | undefined {
	if (!header) return undefined;
	const directives = header.toLowerCase().split(',').map((d) => d.trim());
	if (directives.some((d) => d === 'no-store' || d === 'no-cache')) return 0;
	const maxAge = directives.find((d) => d.startsWith('max-age='));
	if (maxAge) {
		const seconds = Number(maxAge.slice('max-age='.length));
		if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
	}
	return undefined;
}
