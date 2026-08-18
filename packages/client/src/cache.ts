// Optional response cache for FonderieClient. A cache instance is created per
// client (never module-global) so it is safe on a server — one client per
// request means no cross-user/tenant leakage. It sweeps lazily on read, so
// there is no background timer keeping a process alive.

export interface ICache {
	// Returns the cached value if present and still within its TTL, else undefined.
	get<T>(key: string): T | undefined;
	// Stores a value with a per-entry TTL (ms).
	set<T>(key: string, value: T, ttlMs: number): void;
	// Deduplicates concurrent in-flight requests for the same key.
	dedupe<T>(key: string, fn: () => Promise<T>): Promise<T>;
	// Evicts every entry whose key contains `fragment` (and cancels in-flight
	// dedupe for those), so a write can bust the reads it affects.
	invalidate(fragment: string): void;
	clear(): void;
}

export interface IMemoryCacheOptions {
	// Default TTL (ms) applied to cached GETs when a call doesn't specify one.
	defaultTtlMs?: number;
}

interface Entry {
	value: unknown;
	expiresAt: number;
}

export function createMemoryCache(opts: IMemoryCacheOptions = {}): ICache & { defaultTtlMs: number } {
	const store = new Map<string, Entry>();
	const inflight = new Map<string, Promise<unknown>>();
	const defaultTtlMs = opts.defaultTtlMs ?? 60_000;

	return {
		defaultTtlMs,

		get<T>(key: string): T | undefined {
			const entry = store.get(key);
			if (!entry) return undefined;
			if (Date.now() > entry.expiresAt) {
				store.delete(key); // lazy sweep
				return undefined;
			}
			return entry.value as T;
		},

		set<T>(key: string, value: T, ttlMs: number): void {
			store.set(key, { value, expiresAt: Date.now() + ttlMs });
		},

		dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
			const existing = inflight.get(key);
			if (existing) return existing as Promise<T>;
			const req = fn().finally(() => inflight.delete(key));
			inflight.set(key, req);
			return req;
		},

		invalidate(fragment: string): void {
			for (const key of store.keys()) if (key.includes(fragment)) store.delete(key);
			for (const key of inflight.keys()) if (key.includes(fragment)) inflight.delete(key);
		},

		clear(): void {
			store.clear();
			inflight.clear();
		},
	};
}
