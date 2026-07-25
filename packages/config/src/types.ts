export interface IConfigEntry {
	key: string;
	value: unknown;
	environment: string;
	description: string | null;
	active: boolean;
	// Monotonic version index — the compare-and-swap token for optimistic
	// concurrency and the anchor for revisions/rollback.
	version: number;
	updatedBy: string | null;
	updatedAt: string;
}

// One immutable point in a config entry's history (append-only).
export interface IConfigRevision {
	key: string;
	environment: string;
	value: unknown;
	version: number;
	actor: string | null;
	createdAt: string;
}

export interface IConfigSnapshot {
	entries: Record<string, unknown>;
	fetchedAt: Date;
}
