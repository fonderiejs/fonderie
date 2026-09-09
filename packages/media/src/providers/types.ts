/**
 * The storage seam every backend implements — the same pattern @fonderie/billing
 * uses for payment providers. Product code depends on this interface, never on a
 * concrete backend, so `DbBlobProvider` (zero infra) → `S3Provider` (object
 * storage) is a one-line swap in `MediaModule`'s config.
 *
 * Kept to a least-common-denominator on purpose: `put` / `get` / `delete` and
 * nothing backend-specific. The one real divergence between backends — "can you
 * hand the client a URL, or must the app stream the bytes?" — is modelled by the
 * discriminated result of `get`, so an S3 provider can 302 to a signed URL while
 * a DB/filesystem provider serves inline, and the controller never branches on
 * which backend is wired.
 */

/** A backend-opaque handle to a stored object; the module persists it verbatim. */
export interface IStoredRef {
	ref: string;
}

/**
 * The outcome of resolving a ref. `bytes` → the app serves them (content type
 * comes from the asset record, not here). `redirect` → the app 302s to a URL the
 * backend can serve directly (e.g. an S3 signed URL). `null` → not found.
 */
export type IFetched = { kind: 'bytes'; bytes: Uint8Array } | { kind: 'redirect'; url: string };

export interface IStorageProvider {
	/** Stable id for logs/readiness (e.g. 'db-blob', 'local-fs', 's3'). */
	readonly name: string;
	/** Persist bytes; `contentType` is passed for backends that store it natively (S3). */
	put(input: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef>;
	/** Resolve a ref to servable bytes or a redirect URL, or null if it's gone. */
	get(ref: string): Promise<IFetched | null>;
	/** Remove the stored object. Idempotent — deleting a missing ref must not throw. */
	delete(ref: string): Promise<void>;
}
