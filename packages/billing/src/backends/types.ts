export interface ICounterBackend {
	// Increment the counter by `quantity` (default 1) and return the new total.
	// windowMs = null means a lifetime/cumulative counter (no expiry).
	increment(key: string, windowMs: number | null, quantity?: number): Promise<number>;

	// Optional: increment several counters at once and return each new total,
	// in the order given — what withBilling uses so a plan with N windowed
	// limits costs one round-trip, not N. Keys must be distinct. A backend
	// without it is called once per counter, as before.
	incrementMany?(
		entries: ReadonlyArray<{ key: string; windowMs: number | null; quantity?: number }>,
	): Promise<number[]>;

	// Read the current count without incrementing.
	get(key: string, windowMs: number | null): Promise<number>;
}
