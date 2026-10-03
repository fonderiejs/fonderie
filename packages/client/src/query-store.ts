// The read model every screen shares: one entry per query key, readable
// synchronously, observable, refreshed in the background.
//
// Why it exists. Hooks used to start every mount with `isLoading: true` and no
// data, then wait for the network — even for data fetched a moment ago on the
// previous screen. Every screen opened on a spinner, and a refresh that came
// back with the same answer still swapped the screen out and back: flicker.
// The response cache under HttpClient could not help: it honours the server's
// Cache-Control, and an API answering `max-age=0` is cached for 0 ms.
//
// The rules, in one place, so every hook package behaves the same:
//   • What was fetched is shown at once, on every mount (peek is synchronous).
//   • A mount fetches only when the entry is missing or older than staleMs.
//     An explicit refresh (pull-to-refresh) always fetches.
//   • A fetch never removes data. Loading is "nothing to show yet", not "a
//     request is in flight" — a refresh behind data is `isFetching`, not a
//     spinner.
//   • An answer equal to what is shown keeps the SAME data object, so nothing
//     downstream re-renders its content.
//   • A failed refresh keeps the data and reports the error alongside it.
//   • A write invalidates the keys under its resource (the same fragments the
//     HTTP cache already evicts on): mounted screens refetch, the rest refetch
//     when next shown. Sign-out clears everything.
//
// One store per FonderieClient (never module-global), so a server rendering
// for several users never shares entries between them.

export interface IQueryEntry<T = unknown> {
	/** Last good answer. Undefined until the first fetch succeeds. */
	readonly data: T | undefined;
	/** The last fetch's failure, cleared by the next success. Data is kept. */
	readonly error: unknown;
	/** When `data` was last confirmed by the server (ms epoch); 0 = never / invalidated. */
	readonly updatedAt: number;
	/** A fetch for this key is in flight. */
	readonly isFetching: boolean;
}

export interface IQueryFetchOptions {
	/** Fetch even when the entry is fresh — pull-to-refresh, after a write. */
	force?: boolean;
	/** Override the store's staleness window for this call (ms). */
	staleMs?: number;
}

export interface IQueryStoreOptions {
	/**
	 * How long a fetched answer counts as current (ms). Within it, showing a
	 * screen again does not touch the network. Default 5 minutes; `Infinity`
	 * means "only when asked" (pull-to-refresh, a write, a workspace switch).
	 */
	staleMs?: number;
}

type Listener = () => void;

const EMPTY: IQueryEntry = Object.freeze({
	data: undefined,
	error: null,
	updatedAt: 0,
	isFetching: false,
});

export class QueryStore {
	readonly staleMs: number;
	private readonly entries = new Map<string, IQueryEntry>();
	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly inflight = new Map<string, Promise<unknown>>();
	// Per-key request sequence: only the LATEST request for a key may write, so
	// a slow older answer cannot land on top of a newer one.
	private readonly seq = new Map<string, number>();
	// Bumped by clear(): a fetch that started before a sign-out must not write
	// the previous session's answer into the next session's store.
	private generation = 0;

	constructor(opts: IQueryStoreOptions = {}) {
		this.staleMs = opts.staleMs ?? 5 * 60_000;
	}

	/** The entry for `key` right now — synchronous; a stable object until it changes. */
	peek<T>(key: string): IQueryEntry<T> {
		return (this.entries.get(key) ?? EMPTY) as IQueryEntry<T>;
	}

	/** Whether `key` has no answer or its answer is older than the staleness window. */
	isStale(key: string, staleMs: number = this.staleMs): boolean {
		const e = this.entries.get(key);
		return !e || e.updatedAt === 0 || Date.now() - e.updatedAt >= staleMs;
	}

	/** Called whenever `key`'s entry changes. Returns the unsubscribe. */
	subscribe(key: string, listener: Listener): () => void {
		let set = this.listeners.get(key);
		if (!set) {
			set = new Set();
			this.listeners.set(key, set);
		}
		set.add(listener);
		return () => {
			set.delete(listener);
			if (set.size === 0) this.listeners.delete(key);
		};
	}

	/**
	 * Fetch `key` with `fetcher` unless its answer is still fresh. Concurrent
	 * calls for one key share one request. Resolves with the data now held
	 * (which may be the previous answer if this fetch failed) — never rejects:
	 * the failure is on the entry, next to the data it did not replace.
	 */
	async fetch<T>(key: string, fetcher: () => Promise<T>, opts: IQueryFetchOptions = {}): Promise<T | undefined> {
		const running = this.inflight.get(key);
		if (running && !opts.force) {
			await running;
			return this.peek<T>(key).data;
		}
		if (!opts.force && !this.isStale(key, opts.staleMs ?? this.staleMs)) return this.peek<T>(key).data;

		const generation = this.generation;
		const mine = (this.seq.get(key) ?? 0) + 1;
		this.seq.set(key, mine);
		const current = () => generation === this.generation && this.seq.get(key) === mine;
		this.write(key, { ...this.peek(key), isFetching: true });
		const run = (async () => {
			try {
				const next = await fetcher();
				if (!current()) return;
				const prev = this.peek<T>(key);
				this.write(key, {
					// Same answer → same object: whoever renders it sees no change.
					data: prev.data !== undefined && deepEqual(prev.data, next) ? prev.data : next,
					error: null,
					updatedAt: Date.now(),
					isFetching: false,
				});
			} catch (error) {
				if (!current()) return;
				this.write(key, { ...this.peek(key), error, isFetching: false });
			}
		})();
		this.inflight.set(key, run);
		try {
			await run;
		} finally {
			if (this.inflight.get(key) === run) this.inflight.delete(key);
		}
		return this.peek<T>(key).data;
	}

	/**
	 * Put an answer in directly — a write that returned the new state, so the
	 * screens showing it update without another request.
	 */
	set<T>(key: string, data: T): void {
		const prev = this.peek<T>(key);
		this.write(key, {
			data: prev.data !== undefined && deepEqual(prev.data, data) ? prev.data : data,
			error: null,
			updatedAt: Date.now(),
			isFetching: prev.isFetching,
		});
	}

	/**
	 * Mark every key containing `fragment` stale. The data stays on screen;
	 * mounted screens are notified and refetch in the background.
	 */
	invalidate(fragment: string): void {
		for (const [key, entry] of this.entries) {
			if (key.includes(fragment) && entry.updatedAt !== 0) this.write(key, { ...entry, updatedAt: 0 });
		}
	}

	/** Forget everything (sign-out, account switch). Screens fall back to loading. */
	clear(): void {
		this.generation++;
		const keys = [...this.entries.keys()];
		this.entries.clear();
		this.inflight.clear();
		this.seq.clear();
		for (const key of keys) this.notify(key);
	}

	private write(key: string, entry: IQueryEntry): void {
		this.entries.set(key, Object.freeze(entry));
		this.notify(key);
	}

	private notify(key: string): void {
		for (const listener of [...(this.listeners.get(key) ?? [])]) listener();
	}
}

// Structural equality for API answers: JSON-shaped values plus Date. Enough to
// tell "the server said the same thing" without a dependency.
export function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (a instanceof Date || b instanceof Date) {
		return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	}
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		const bb = b as unknown[];
		return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
	}
	const ka = Object.keys(a as object);
	const kb = Object.keys(b as object);
	if (ka.length !== kb.length) return false;
	return ka.every(
		(k) =>
			Object.prototype.hasOwnProperty.call(b, k) &&
			deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
	);
}

// Which store a client — or one of its sub-clients (client.billing, …) —
// reads through. Hooks receive whichever object the app handed them; this maps
// each to its FonderieClient's one store without every sub-client class
// carrying a field. A client nobody registered (a standalone admin client)
// gets a store of its own on first use.
const registry = new WeakMap<object, QueryStore>();

export function registerQueryStore(owner: object, store: QueryStore): void {
	registry.set(owner, store);
}

export function queryStoreFor(owner: object): QueryStore {
	let store = registry.get(owner);
	if (!store) {
		store = new QueryStore();
		registry.set(owner, store);
	}
	return store;
}
