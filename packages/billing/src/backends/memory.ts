import type { ICounterBackend } from './types';

interface Entry {
	count: number;
	windowStart: number; // epoch ms — used for windowed expiry
}

export class MemoryCounterBackend implements ICounterBackend {
	private readonly counters = new Map<string, Entry>();

	async increment(key: string, windowMs: number | null, quantity = 1): Promise<number> {
		const now = Date.now();
		const existing = this.counters.get(key);

		if (!existing || (windowMs !== null && now - existing.windowStart >= windowMs)) {
			this.counters.set(key, { count: quantity, windowStart: now });
			return quantity;
		}

		existing.count += quantity;
		return existing.count;
	}

	async get(key: string, windowMs: number | null): Promise<number> {
		const now = Date.now();
		const existing = this.counters.get(key);
		if (!existing) return 0;
		if (windowMs !== null && now - existing.windowStart >= windowMs) return 0;
		return existing.count;
	}
}
