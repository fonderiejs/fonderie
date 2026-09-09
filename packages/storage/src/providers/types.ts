/**
 * The storage seam every backend implements — the same provider pattern
 * @fonderie/billing uses for payment providers. Product code (media uploads, DB
 * archives, anything) depends on this interface, never on a concrete backend,
 * so `DbBlobProvider` (zero infra) → `S3Provider` (object storage / MinIO) is a
 * one-line swap in the consumer's config.
 *
 * Deliberately content-agnostic and least-common-denominator: `put` / `get` /
 * `delete` of raw bytes, nothing backend-specific and nothing about *what* the
 * bytes are. The one real divergence between backends — "can you hand the client
 * a URL, or must the app stream the bytes?" — is modelled by the discriminated
 * result of `get`, so an S3 provider can return a presigned URL while a DB /
 * filesystem provider returns bytes, and the caller never branches on which.
 */

/** A backend-opaque handle to a stored object; the consumer persists it verbatim. */
export interface IStoredRef {
	ref: string;
}

/**
 * The outcome of resolving a ref. `bytes` → the caller has the raw bytes (serve
 * them / write them to a file / parse them). `redirect` → a URL the backend can
 * serve directly (e.g. an S3 presigned URL) — hand it to the client. `null` →
 * not found.
 */
export type IFetched = { kind: 'bytes'; bytes: Uint8Array } | { kind: 'redirect'; url: string };

export interface IStorageProvider {
	/** Stable id for logs/diagnostics (e.g. 'db-blob', 'local-fs', 's3'). */
	readonly name: string;
	/** Persist bytes; `contentType` is passed for backends that store it natively (S3). */
	put(input: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef>;
	/**
	 * Resolve a ref to bytes or a redirect URL, or null if it's gone.
	 *
	 * NOTE on `null`: DbBlob/LocalFs verify existence and return `null` for a
	 * missing ref. `S3Provider` returns a presigned `redirect` WITHOUT a
	 * round-trip to check existence, so a missing key yields a redirect URL that
	 * 404s when followed rather than `null`. Consumers that must detect "gone"
	 * without following the URL should keep their own metadata (as
	 * `@fonderie/media` does with its asset row) rather than rely on `null`.
	 */
	get(ref: string): Promise<IFetched | null>;
	/** Remove the stored object. Idempotent — deleting a missing ref must not throw. */
	delete(ref: string): Promise<void>;
}
