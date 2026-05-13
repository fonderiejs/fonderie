export interface ICounterBackend {
	// Increment the counter by `quantity` (default 1) and return the new total.
	// windowMs = null means a lifetime/cumulative counter (no expiry).
	increment(key: string, windowMs: number | null, quantity?: number): Promise<number>

	// Read the current count without incrementing.
	get(key: string, windowMs: number | null): Promise<number>
}
