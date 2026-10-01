import type { ICache } from './cache';
import { HttpClient } from './http';
import { AuditClient } from './modules/audit';
import { AuthClient } from './modules/auth';
import { BillingClient } from './modules/billing';
import { CustomersClient } from './modules/customers';
import { MediaClient } from './modules/media';
import { ConfigClient, type IClientLog, type IConfigStorage } from './modules/config';
import { SseClient, type FetchLike } from './modules/sse';
import { WebhooksClient } from './modules/webhooks';
import { WorkspacesClient } from './modules/workspaces';
import { TokenStore } from './token-store';
import type { IApiResponse, ITokens } from './types';

// Reactive token renewal. When set, the client refreshes once on a 401 and
// retries the request. The app owns where the refresh token lives and where new
// tokens are persisted.
export interface IClientAuthConfig {
	getRefreshToken?: () => string | undefined;
	onTokensChanged?: (tokens: ITokens) => void;
	onAuthError?: () => void;
}

export interface IFonderieClientOptions {
	baseUrl: string;
	accessToken?: string;
	workspaceId?: string;
	// Opt-in response cache (see createMemoryCache). Omit for no caching.
	cache?: ICache;
	// Opt-in reactive renew.
	auth?: IClientAuthConfig;
	// Server-Sent Events (@fonderie/sse). `fetch` must return a readable body
	// stream: browsers' does; in React Native pass Expo's `fetch` from
	// 'expo/fetch' (the default RN fetch cannot stream — the client then
	// reports 'unavailable', and remote config refreshes only on the next start).
	// `baseUrl`: where the stream lives when it is not the API's origin — a
	// serverless API cannot hold streams, so they are often served by a
	// separate long-running host. Default: `baseUrl` above.
	sse?: { fetch?: FetchLike; baseUrl?: string };
	// Public remote config. `storage` keeps the last answer on the device so a
	// cold start without signal decides from it (AsyncStorage, localStorage);
	// hold the first render on `client.config.ready`.
	config?: { storage?: IConfigStorage };
	// Where the client reports problems (a missing config key, a stream it
	// cannot open). Default: console.
	log?: IClientLog;
	// The platform this app runs on. A sign-in then gets that platform's session
	// lifetimes (e.g. a phone stays signed in longer than a shared browser);
	// the server records it on the session. Unset: the shared lifetimes.
	clientKind?: 'mobile' | 'desktop' | 'web';
	// Live sign-out: while signed in, listen for fonderie.session.revoked on the
	// stream; when it names this device's session (or all of them), clear the
	// tokens and call auth.onAuthError — "sign out this device" lands at once.
	// On by default when `sse` is configured; false to turn it off.
	liveSignOut?: boolean;
}

// Per-call options for the generic transport.
export interface IRequestConfig {
	workspaceId?: string;
	// Per-call Bearer override — e.g. the MFA-login step, where a temporary
	// mfaToken is used before the session access token exists. Defaults to the
	// client's stored token.
	token?: string;
	// Cache this GET for `cache` ms; false to skip; bust to force-refresh.
	cache?: number | false;
	bust?: boolean;
	// Extra cache key fragments to evict after a write.
	invalidate?: string[];
}

export class FonderieClient {
	readonly auth: AuthClient;
	readonly billing: BillingClient;
	readonly workspaces: WorkspacesClient;
	readonly audit: AuditClient;
	readonly webhooks: WebhooksClient;
	readonly customers: CustomersClient;
	readonly media: MediaClient;
	/** Public remote config: flags and settings the server exposes to frontends. */
	readonly config: ConfigClient;
	/** Server-Sent Events: subscribe to all or individual events, one shared connection. */
	readonly sse: SseClient;

	private http: HttpClient;
	private tokens: TokenStore;
	private workspaceId: string | undefined;
	private cache: ICache | undefined;
	private authConfig: IClientAuthConfig | undefined;
	private refreshing: Promise<string | undefined> | null = null;

	constructor(opts: IFonderieClientOptions) {
		this.tokens = new TokenStore(opts.accessToken);
		this.workspaceId = opts.workspaceId;
		this.cache = opts.cache;
		this.authConfig = opts.auth;
		this.http = new HttpClient(opts.baseUrl, {
			clientKind: opts.clientKind,
			cache: opts.cache,
			defaultTtlMs: (opts.cache as { defaultTtlMs?: number } | undefined)?.defaultTtlMs,
			refresh: opts.auth ? () => this.doRefresh() : undefined,
		});
		this.auth = new AuthClient(this.http, this.tokens);
		this.billing = new BillingClient(this.http, this.tokens);
		this.workspaces = new WorkspacesClient(this.http, this.tokens);
		this.audit = new AuditClient(this.http, this.tokens);
		this.webhooks = new WebhooksClient(this.http, this.tokens);
		this.customers = new CustomersClient(this.http, this.tokens);
		// Media is per-user (ownership via ownerType/ownerId in the body), so no
		// setWorkspaceId wiring below — just the shared http + token store.
		this.media = new MediaClient(this.http, this.tokens);
		this.sse = new SseClient({
			absolute: (path) => (opts.sse?.baseUrl ? `${opts.sse.baseUrl.replace(/\/$/, '')}${path}` : this.http.absolute(path)),
			tokens: this.tokens,
			getWorkspaceId: () => this.workspaceId,
			refresh: opts.auth ? () => this.doRefresh() : undefined,
			fetch: opts.sse?.fetch,
			log: opts.log,
		});
		this.config = new ConfigClient(this.http, this.tokens, this.sse, { storage: opts.config?.storage, log: opts.log });

		// Live sign-out (docs/SESSION-DESIGN.md, Phase 5): only when the app
		// configured the stream — apps without @fonderie/sse see no change.
		if (opts.sse && opts.liveSignOut !== false) {
			let stop: (() => void) | undefined;
			const follow = () => {
				const signedIn = Boolean(this.tokens.get());
				if (signedIn && !stop) {
					stop = this.sse.subscribe(['fonderie.session.revoked'], (event) => this.sessionRevoked(event.data));
				} else if (!signedIn && stop) {
					stop();
					stop = undefined;
				}
			};
			this.tokens.onChange(follow);
			follow();
		}
		// Route through the setter so the constructor option scopes the
		// workspace-aware modules exactly like a later setWorkspaceId() call.
		if (opts.workspaceId !== undefined) this.setWorkspaceId(opts.workspaceId);
	}

	// Single-flight refresh: POST /auth/refresh with the app-supplied refresh
	// token, store the new access token, notify the app, return it for the retry.
	// A revocation names sessions by their sid (or null = all of the user's).
	// This device's sid is in its own access token.
	private sessionRevoked(data: Record<string, unknown>): void {
		const sids = data['sids'];
		const mine = tokenSid(this.tokens.get());
		const hit = sids === null || (Array.isArray(sids) && mine !== undefined && sids.includes(mine));
		if (!hit) return;
		this.tokens.set(undefined);
		this.clearCache();
		this.authConfig?.onAuthError?.();
	}

	private doRefresh(): Promise<string | undefined> {
		if (this.refreshing) return this.refreshing;
		this.refreshing = (async () => {
			const refreshToken = this.authConfig?.getRefreshToken?.();
			if (!refreshToken) {
				this.authConfig?.onAuthError?.();
				return undefined;
			}
			try {
				const { result } = await this.auth.refreshTokens(refreshToken);
				const tokens = (result as unknown as { tokens: ITokens }).tokens;
				this.tokens.set(tokens.access);
				this.authConfig?.onTokensChanged?.(tokens);
				return tokens.access;
			} catch {
				this.tokens.set(undefined);
				this.authConfig?.onAuthError?.();
				return undefined;
			} finally {
				this.refreshing = null;
			}
		})();
		return this.refreshing;
	}

	// The JWT used to authenticate every request — the typed modules and the
	// generic transport share one token store. Passing undefined signs out and
	// clears the cache (so no session's data survives a logout).
	setAccessToken(token: string | undefined): void {
		this.tokens.set(token);
		if (!token) this.clearCache();
	}

	// Drop all cached responses (e.g. on switching accounts).
	clearCache(): void {
		this.cache?.clear();
	}

	// Default X-Workspace-ID for the generic transport, also propagated to the
	// workspace-scoped modules so one call configures the whole client.
	setWorkspaceId(workspaceId: string | undefined): void {
		this.workspaceId = workspaceId;
		this.billing.setWorkspaceId(workspaceId);
		this.workspaces.setWorkspaceId(workspaceId);
		this.customers.setWorkspaceId(workspaceId);
		this.audit.setWorkspaceId(workspaceId);
		this.webhooks.setWorkspaceId(workspaceId);
		// A stream is scoped to the workspace it was opened in.
		this.sse?.identityChanged();
	}

	// ── Generic transport ──────────────────────────────────────────────────────
	// A Fonderie-aware HTTP client for endpoints outside the typed modules (an
	// app's own routes on the same backend). It attaches the shared JWT and
	// X-Workspace-ID automatically and returns Fonderie's { reason, explanation,
	// result } envelope — so you don't hand-roll auth for custom endpoints.

	request<T = unknown>(opts: {
		method: string;
		path: string;
		body?: unknown;
		token?: string | undefined;
		workspaceId?: string | undefined;
		cache?: number | false | undefined;
		bust?: boolean | undefined;
		invalidate?: string[] | undefined;
	}): Promise<IApiResponse<T>> {
		return this.http.request<IApiResponse<T>>({
			method: opts.method,
			path: opts.path,
			body: opts.body,
			token: opts.token ?? this.tokens.get(),
			workspaceId: opts.workspaceId ?? this.workspaceId,
			cache: opts.cache,
			bust: opts.bust,
			invalidate: opts.invalidate,
		});
	}

	get<T = unknown>(path: string, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({
			method: 'GET',
			path,
			token: config?.token,
			workspaceId: config?.workspaceId,
			cache: config?.cache,
			bust: config?.bust,
		});
	}

	post<T = unknown>(
		path: string,
		body?: unknown,
		config?: IRequestConfig,
	): Promise<IApiResponse<T>> {
		return this.request<T>({
			method: 'POST',
			path,
			body,
			token: config?.token,
			workspaceId: config?.workspaceId,
			invalidate: config?.invalidate,
		});
	}

	put<T = unknown>(
		path: string,
		body?: unknown,
		config?: IRequestConfig,
	): Promise<IApiResponse<T>> {
		return this.request<T>({
			method: 'PUT',
			path,
			body,
			token: config?.token,
			workspaceId: config?.workspaceId,
			invalidate: config?.invalidate,
		});
	}

	patch<T = unknown>(
		path: string,
		body?: unknown,
		config?: IRequestConfig,
	): Promise<IApiResponse<T>> {
		return this.request<T>({
			method: 'PATCH',
			path,
			body,
			token: config?.token,
			workspaceId: config?.workspaceId,
			invalidate: config?.invalidate,
		});
	}

	delete<T = unknown>(path: string, config?: IRequestConfig): Promise<IApiResponse<T>> {
		return this.request<T>({
			method: 'DELETE',
			path,
			token: config?.token,
			workspaceId: config?.workspaceId,
			invalidate: config?.invalidate,
		});
	}
}

// The session id (`sid` claim) of an access token, or undefined.
function tokenSid(token: string | undefined): string | undefined {
	const payload = token?.split('.')[1];
	if (!payload) return undefined;
	try {
		const json = typeof atob === 'function' ? atob(payload.replace(/-/g, '+').replace(/_/g, '/')) : '';
		const sid = (JSON.parse(json) as { sid?: unknown }).sid;
		return typeof sid === 'string' ? sid : undefined;
	} catch {
		return undefined;
	}
}
