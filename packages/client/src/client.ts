import type { ICache } from './cache';
import { QueryStore, registerQueryStore, type IQueryStoreOptions } from './query-store';
import { FonderieApiError, HttpClient, isSessionRefusal } from './http';
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
	/**
	 * The session is over, definitively: sign the user out (once) and say why.
	 * Never called for a network failure — the client keeps the session and
	 * reports 'offline' instead, so a phone in a tunnel stays signed in.
	 */
	onAuthError?: (info: IAuthErrorInfo) => void;
}

/**
 * Where a session stands, as far as this device knows:
 *   signedOut  no session on this device
 *   active     signed in, and the server is answering
 *   offline    signed in, but the server cannot be reached — keep the user in
 *   revoked    the server refused the session (signed out elsewhere, expired,
 *              theft detected); the app signs out once, with a message
 */
export type SessionState = 'signedOut' | 'active' | 'offline' | 'revoked';

export interface IAuthErrorInfo {
	/**
	 * 'revoked'          the server announced it live (another device, a password
	 *                    change, an operator); `detail` is its reason
	 * 'expired'          the refresh was refused (expired, revoked while away,
	 *                    reuse detected); `detail` is the server's reason code
	 * 'no-refresh-token' a request was refused and there is nothing to renew with
	 */
	reason: 'revoked' | 'expired' | 'no-refresh-token';
	detail?: string;
}

export interface IFonderieClientOptions {
	baseUrl: string;
	accessToken?: string;
	workspaceId?: string;
	// Opt-in response cache (see createMemoryCache). Omit for no caching.
	cache?: ICache;
	// The screens' read model (client.queries): how long a fetched answer
	// counts as current before showing a screen again refetches it in the
	// background. Default 5 minutes.
	queries?: IQueryStoreOptions;
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
	/**
	 * What every screen reads through: fetched answers shown at once, refreshed
	 * in the background, never replaced by a spinner (see query-store.ts). The
	 * frontend hook packages use it; apps rarely touch it directly.
	 */
	readonly queries: QueryStore;
	private authConfig: IClientAuthConfig | undefined;
	private refreshing: Promise<string | undefined> | null = null;
	private _session: SessionState;
	private readonly sessionListeners = new Set<(state: SessionState) => void>();
	private readonly workspaceListeners = new Set<(workspaceId: string | undefined) => void>();

	constructor(opts: IFonderieClientOptions) {
		this.tokens = new TokenStore(opts.accessToken);
		this._session = opts.accessToken ? 'active' : 'signedOut';
		// A token appearing (sign-in, restore) makes the session active; one
		// disappearing without a reason (setAccessToken(undefined)) is a sign-out.
		this.tokens.onChange(() => {
			if (this.tokens.get()) this.setSession('active');
			else {
				// Whatever ended the session (sign-out, revocation), nothing the
				// screens held for it may show to whoever signs in next.
				this.queries?.clear();
				if (this._session !== 'revoked') this.setSession('signedOut');
			}
		});
		this.workspaceId = opts.workspaceId;
		this.cache = opts.cache;
		this.queries = new QueryStore(opts.queries);
		this.authConfig = opts.auth;
		this.http = new HttpClient(opts.baseUrl, {
			clientKind: opts.clientKind,
			cache: opts.cache,
			defaultTtlMs: (opts.cache as { defaultTtlMs?: number } | undefined)?.defaultTtlMs,
			refresh: opts.auth ? () => this.doRefresh() : undefined,
			onReachability: (reachable) => {
				if (!this.tokens.get()) return;
				this.setSession(reachable ? 'active' : 'offline');
			},
			onWrite: (fragments) => {
				for (const fragment of fragments) this.queries.invalidate(fragment);
			},
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
		// Hooks receive the client or one of its sub-clients: each reads the
		// same store.
		for (const owner of [this, this.auth, this.billing, this.workspaces, this.audit, this.webhooks, this.customers, this.media, this.config]) {
			registerQueryStore(owner, this.queries);
		}

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
		const reason = typeof data['reason'] === 'string' ? data['reason'] : undefined;
		this.endSession({ reason: 'revoked', ...(reason ? { detail: reason } : {}) });
	}

	/** Where this device's session stands. */
	get session(): SessionState {
		return this._session;
	}

	/** Called on every change of `session`. Returns an unsubscribe function. */
	onSessionChange(listener: (state: SessionState) => void): () => void {
		this.sessionListeners.add(listener);
		return () => {
			this.sessionListeners.delete(listener);
		};
	}

	private setSession(state: SessionState): void {
		if (state === this._session) return;
		this._session = state;
		for (const listener of this.sessionListeners) {
			try {
				listener(state);
			} catch {
				// a listener's bug must not break the client
			}
		}
	}

	// A definitive end: state first, so a listener reading `session` during
	// onAuthError already sees 'revoked'.
	private endSession(info: IAuthErrorInfo): void {
		this.setSession('revoked');
		this.tokens.set(undefined);
		this.clearCache();
		this.authConfig?.onAuthError?.(info);
	}

	private doRefresh(): Promise<string | undefined> {
		if (this.refreshing) return this.refreshing;
		this.refreshing = (async () => {
			const refreshToken = this.authConfig?.getRefreshToken?.();
			if (!refreshToken) {
				this.endSession({ reason: 'no-refresh-token' });
				return undefined;
			}
			try {
				const { result } = await this.auth.refreshTokens(refreshToken);
				const tokens = (result as unknown as { tokens: ITokens }).tokens;
				this.tokens.set(tokens.access);
				this.setSession('active');
				this.authConfig?.onTokensChanged?.(tokens);
				return tokens.access;
			} catch (err) {
				// Only the server saying no ends the session. A network failure,
				// a 5xx or a rate limit is not an answer about the session: keep
				// it, report 'offline' (or stay active), and let the next request
				// try again. Signing out here signed phones out in tunnels.
				if (isSessionRefusal(err)) {
					this.endSession({ reason: 'expired', ...(err.reason ? { detail: err.reason } : {}) });
				} else if (!(err instanceof FonderieApiError)) {
					this.setSession('offline');
				}
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

	// Drop all cached responses (e.g. on switching accounts) — and everything
	// the screens hold, so no session's data survives into the next.
	clearCache(): void {
		this.cache?.clear();
		this.queries.clear();
	}

	// Default X-Workspace-ID for the generic transport, also propagated to the
	// workspace-scoped modules so one call configures the whole client.
	setWorkspaceId(workspaceId: string | undefined): void {
		const changed = workspaceId !== this.workspaceId;
		this.workspaceId = workspaceId;
		this.billing.setWorkspaceId(workspaceId);
		this.workspaces.setWorkspaceId(workspaceId);
		this.customers.setWorkspaceId(workspaceId);
		this.audit.setWorkspaceId(workspaceId);
		this.webhooks.setWorkspaceId(workspaceId);
		// A stream is scoped to the workspace it was opened in.
		this.sse?.identityChanged();
		if (!changed) return;
		for (const listener of this.workspaceListeners) {
			try {
				listener(workspaceId);
			} catch {
				// A listener's failure must not stop the others.
			}
		}
	}

	/** The workspace requests are scoped to (X-Workspace-ID), if any. */
	getWorkspaceId(): string | undefined {
		return this.workspaceId;
	}

	/**
	 * Called whenever setWorkspaceId changes the workspace, so per-workspace
	 * data on screen (a subscription, members, invoices) can re-read. Returns
	 * an unsubscribe function.
	 */
	onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void {
		this.workspaceListeners.add(listener);
		return () => {
			this.workspaceListeners.delete(listener);
		};
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
