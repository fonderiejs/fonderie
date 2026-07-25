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

// A secret's metadata — deliberately **without** the value. Admin list/get
// return this; only the explicit reveal path returns the decrypted value.
export interface ISecretEntry {
	key: string;
	environment: string;
	description: string | null;
	active: boolean;
	version: number;
	updatedBy: string | null;
	updatedAt: string;
}

// A secret revision's metadata (no value).
export interface ISecretRevision {
	key: string;
	environment: string;
	version: number;
	actor: string | null;
	createdAt: string;
}
