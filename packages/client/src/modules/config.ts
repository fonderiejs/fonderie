import type { HttpClient } from '../http';
import type { SseClient } from './sse';
import type { TokenStore } from '../token-store';
import type { IApiResponse } from '../types';

// ── Public remote config ─────────────────────────────────────────────────────
// The frontend's read path for feature flags and runtime settings: only the
// keys the server lists in ConfigModule's `publicKeys`. One snapshot per
// FonderieClient, shared by every screen that reads it.
//
// Apps do not drive this directly: they read a key with useRemoteConfig(key,
// fallback) or wrap a screen with withRemoteConfig (@fonderie/react, /vue).
// Those bindings keep it LIVE — there is no polling and no opt-in:
//   • the first reader opens the shared stream (@fonderie/sse) and loads;
//   • 'fonderie.config.changed' re-reads; so does every (re)connect, since a
//     change may have been missed while the stream was down;
//   • the last reader closes the stream.
// With `storage`, the last answer is kept on the device and restored before
// the first render, so a cold start with no signal decides from last-known
// values instead of fallbacks (docs/REALTIME-DESIGN.md §4.7).

export interface IRemoteConfigState {
	/** key → value: last loaded, or restored from storage. Empty until either. */
	values: Readonly<Record<string, unknown>>;
	/** When values were last loaded from the server; null before that. */
	loadedAt: Date | null;
	isLoading: boolean;
	/** The last load's failure, cleared by the next success. Values are kept. */
	error: unknown;
}

/**
 * Where the last answer is kept between launches. AsyncStorage and
 * window.localStorage both fit as they are; sync or async.
 */
export interface IConfigStorage {
	getItem(key: string): string | null | undefined | Promise<string | null | undefined>;
	setItem(key: string, value: string): void | Promise<void>;
}

/** Where the client reports problems. Default: console. */
export interface IClientLog {
	warn(message: string): void;
}

export interface IConfigClientOptions {
	storage?: IConfigStorage | undefined;
	log?: IClientLog | undefined;
}

type Listener = (state: IRemoteConfigState) => void;

/**
 * Whether a remote switch is on. The console stores what the operator typed,
 * so the obvious "off" spellings count as off, not only the boolean: false, 0,
 * null, '' and the strings false / off / 0 / no (any case, trimmed). Anything
 * else is on. withRemoteConfig decides with this.
 */
export function isSwitchOn(value: unknown): boolean {
	if (value === false || value === 0 || value === null || value === undefined) return false;
	if (typeof value === 'string') return !['', 'false', 'off', '0', 'no'].includes(value.trim().toLowerCase());
	return true;
}

const STORAGE_KEY = 'fonderie.config.public';

export class ConfigClient {
	private state: IRemoteConfigState = { values: {}, loadedAt: null, isLoading: false, error: null };
	private listeners = new Set<Listener>();
	private inFlight: Promise<IRemoteConfigState> | null = null;
	private readers = 0;
	private stopStream: (() => void) | undefined;
	private readonly warned = new Set<string>();
	// Keys something has read, with their fallback — checked on every answer.
	// A reader of a missing key never re-renders (its value did not change), so
	// the check cannot wait for the next get().
	private readonly asked = new Map<string, unknown>();
	private readonly storage: IConfigStorage | undefined;
	private readonly log: IClientLog;

	/**
	 * Settles once values saved on the device have been restored (at once
	 * without `storage`). Hold the first render on it — e.g. PersistGate's
	 * onBeforeLift, or before hiding the splash — so it never shows fallbacks
	 * for a moment. Never rejects: unreadable storage just means no restore.
	 */
	readonly ready: Promise<void>;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
		private sse?: SseClient,
		options: IConfigClientOptions = {},
	) {
		this.storage = options.storage;
		this.log = options.log ?? console;
		this.ready = this.restore();
	}

	/**
	 * Keep the snapshot live while something reads it; returns the release.
	 * Reference-counted: bindings call it per mounted reader. Apps use
	 * useRemoteConfig / withRemoteConfig rather than calling this.
	 */
	retain(): () => void {
		if (this.readers++ === 0) {
			if (!this.state.loadedAt && !this.inFlight) void this.load();
			if (this.sse) {
				this.stopStream = this.sse.subscribe(['fonderie.config.changed'], () => void this.load(), {
					onReset: () => void this.load(),
				});
			}
		}
		let released = false;
		return () => {
			if (released) return;
			released = true;
			if (--this.readers === 0) {
				this.stopStream?.();
				this.stopStream = undefined;
			}
		};
	}

	// GET /config/public into the shared snapshot. Concurrent calls share one
	// request. A failure keeps the previous values (a flag that was on does not
	// flicker off because one refresh failed) and is reported in `error`.
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
				// The event IS the invalidation: a load happens because the server
				// said config changed (or the stream reconnected), so it skips any
				// cached answer, fetches, and stores the fresh one. Readers never
				// fetch — they read the snapshot. Without this, a response cache
				// handed back the old value the event just reported gone.
				bust: true,
			})
			.then(
				(res) => {
					const values = res.result?.values ?? {};
					const changed = !sameValues(values, this.state.values);
					const next = this.set({ values, loadedAt: new Date(), isLoading: false, error: null });
					if (changed) this.save(values);
					for (const [key, fallback] of this.asked) if (!Object.hasOwn(values, key)) this.warnMissing(key, fallback);
					return next;
				},
				(error: unknown) => this.set({ isLoading: false, error }),
			)
			.finally(() => {
				this.inFlight = null;
			});
		return this.inFlight;
	}

	/**
	 * One value, or `fallback` when the key is absent: before any answer, or
	 * when the server does not expose it. Pick the SAFE fallback. A key still
	 * absent after the server answered is warned about once — usually a typo,
	 * or a key missing from the server's `publicKeys`.
	 */
	get<T>(key: string, fallback: T): T {
		if (!this.asked.has(key)) this.asked.set(key, fallback);
		if (Object.hasOwn(this.state.values, key)) return this.state.values[key] as T;
		if (this.state.loadedAt) this.warnMissing(key, fallback);
		return fallback;
	}

	private warnMissing(key: string, fallback: unknown): void {
		if (this.warned.has(key)) return;
		this.warned.add(key);
		this.log.warn(
			`[fonderie] remote config "${key}" is not a public key on the server — using the fallback (${JSON.stringify(fallback)}). ` +
				'Check the spelling, or add it to ConfigModule publicKeys.',
		);
	}

	/** The whole current state (values, loadedAt, isLoading, error). */
	snapshot(): IRemoteConfigState {
		return this.state;
	}

	/** Called with the new state after every change; returns an unsubscribe. */
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private async restore(): Promise<void> {
		if (!this.storage) return;
		try {
			const raw = await this.storage.getItem(STORAGE_KEY);
			if (!raw || this.state.loadedAt) return; // a live answer already won
			const values = JSON.parse(raw) as unknown;
			if (values && typeof values === 'object' && !Array.isArray(values)) this.set({ values: { ...(values as Record<string, unknown>) } });
		} catch (err) {
			this.log.warn(`[fonderie] could not restore saved remote config: ${(err as Error)?.message ?? String(err)}`);
		}
	}

	private save(values: Readonly<Record<string, unknown>>): void {
		if (!this.storage) return;
		void Promise.resolve()
			.then(() => this.storage?.setItem(STORAGE_KEY, JSON.stringify(values)))
			.catch((err: unknown) => this.log.warn(`[fonderie] could not save remote config: ${(err as Error)?.message ?? String(err)}`));
	}

	private set(patch: Partial<IRemoteConfigState>): IRemoteConfigState {
		// A new object each time, so React's useSyncExternalStore and Vue refs
		// see a change by identity.
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
		return this.state;
	}
}

// Public config values are JSON, so a key-by-key JSON compare is exact.
function sameValues(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every((k) => Object.hasOwn(b, k) && JSON.stringify(a[k]) === JSON.stringify(b[k]));
}
