import type { IBillingProvider, IResolvedPrice } from '../providers/types';

export interface IPriceCacheOptions {
	ttlMs?: number | undefined; // fresh window — default 5m
	graceMs?: number | undefined; // serve last-cached on transient miss (transfer race) — default 1h
	maxStaleMs?: number | undefined; // serve last-cached during provider outage — default 24h
}

export interface IPriceLookup {
	/** Resolved price, or null if it could not be resolved at all. */
	price: IResolvedPrice | null;
	/** True when the returned price is served past its fresh TTL (transfer grace / outage). */
	stale: boolean;
}

/**
 * Read-through cache over the billing provider's price resolution.
 * - fresh within `ttlMs`
 * - single-flight: concurrent misses for the same id share one provider call (§16.2)
 * - transient miss (provider returns null — e.g. lookup_key transfer window) →
 *   serve last-cached within `graceMs`, marked stale (§16.1)
 * - provider throws (outage) → serve last-cached within `maxStaleMs`, marked stale (§16.8)
 */
export class PriceCache {
	private readonly ttl: number;
	private readonly grace: number;
	private readonly maxStale: number;
	private readonly byId = new Map<string, { price: IResolvedPrice; at: number }>();
	private readonly inflight = new Map<string, Promise<IResolvedPrice | null>>();

	constructor(opts: IPriceCacheOptions = {}) {
		this.ttl = opts.ttlMs ?? 300_000;
		this.grace = opts.graceMs ?? 3_600_000;
		this.maxStale = opts.maxStaleMs ?? 86_400_000;
	}

	async byPriceId(priceId: string, provider: IBillingProvider): Promise<IPriceLookup> {
		const now = Date.now();
		const hit = this.byId.get(priceId);
		if (hit && now - hit.at < this.ttl) return { price: hit.price, stale: false };

		let fresh: IResolvedPrice | null;
		try {
			fresh = await this.single(priceId, () => provider.resolvePriceById(priceId));
		} catch {
			// Provider outage — serve last-cached within maxStale.
			if (hit && now - hit.at < this.maxStale) return { price: hit.price, stale: true };
			return { price: null, stale: true };
		}
		if (fresh) {
			this.byId.set(priceId, { price: fresh, at: now });
			return { price: fresh, stale: false };
		}
		// Transient miss (e.g. lookup_key transfer window) — serve last-cached within grace.
		if (hit && now - hit.at < this.grace) return { price: hit.price, stale: true };
		return { price: null, stale: true };
	}

	invalidate(priceId?: string): void {
		if (priceId) this.byId.delete(priceId);
		else this.byId.clear();
	}

	/** Warm the cache with prices already resolved elsewhere (e.g. boot guard). */
	prime(prices: Iterable<IResolvedPrice>): void {
		const now = Date.now();
		for (const p of prices) this.byId.set(p.priceId, { price: p, at: now });
	}

	private single(key: string, run: () => Promise<IResolvedPrice | null>): Promise<IResolvedPrice | null> {
		const existing = this.inflight.get(key);
		if (existing) return existing;
		const p = run().finally(() => this.inflight.delete(key));
		this.inflight.set(key, p);
		return p;
	}
}
