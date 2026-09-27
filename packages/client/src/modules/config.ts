import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type { IApiResponse } from '../types';

// ── Public remote config ─────────────────────────────────────────────────────
// The frontend's read path for feature flags and runtime settings: only the
// keys the server lists in ConfigModule's `publicKeys`. One snapshot per
// FonderieClient, shared by every screen and hook that reads it — load it once
// (typically right after sign-in, or at app start for signed-out flags), then
// read synchronously anywhere.

export interface IRemoteConfigState {
	/** key → value, as last loaded. Empty until the first load succeeds. */
	values: Readonly<Record<string, unknown>>;
	/** When values were last loaded successfully; null before that. */
	loadedAt: Date | null;
	isLoading: boolean;
	/** The last load's failure, cleared by the next success. Values are kept. */
	error: unknown;
}

type Listener = (state: IRemoteConfigState) => void;

export class ConfigClient {
	private state: IRemoteConfigState = { values: {}, loadedAt: null, isLoading: false, error: null };
	private listeners = new Set<Listener>();
	private inFlight: Promise<IRemoteConfigState> | null = null;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	// GET /config/public — fetch the public values into the shared snapshot.
	// Concurrent calls share one request. A failure keeps the previous values
	// (a flag that was on does not flicker off because one refresh failed) and
	// is reported in `error`; before any success, reads fall back to defaults.
	load(): Promise<IRemoteConfigState> {
		if (this.inFlight) return this.inFlight;
		this.set({ isLoading: true });
		this.inFlight = this.http
			.request<IApiResponse<{ values: Record<string, unknown> }>>({
				method: 'GET',
				path: '/config/public',
				// Sent when signed in, so per-user values can be served later
				// without a client change; the route itself is public.
				token: this.tokens.get(),
			})
			.then(
				(res) => this.set({ values: res.result?.values ?? {}, loadedAt: new Date(), isLoading: false, error: null }),
				(error: unknown) => this.set({ isLoading: false, error }),
			)
			.finally(() => {
				this.inFlight = null;
			});
		return this.inFlight;
	}

	// One value, with the fallback used when the key is absent — before the
	// first load, when it failed, or when the server does not expose the key.
	// Pick the SAFE fallback (feature off), not the optimistic one.
	get<T>(key: string, fallback: T): T {
		return Object.hasOwn(this.state.values, key) ? (this.state.values[key] as T) : fallback;
	}

	// The whole current state (values, loadedAt, isLoading, error).
	snapshot(): IRemoteConfigState {
		return this.state;
	}

	// Called with the new state after every change; returns an unsubscribe.
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private set(patch: Partial<IRemoteConfigState>): IRemoteConfigState {
		// A new object each time, so React's useSyncExternalStore and Vue refs
		// see a change by identity.
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
		return this.state;
	}
}
