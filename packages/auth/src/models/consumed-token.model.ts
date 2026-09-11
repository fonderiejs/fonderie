import type { IStoreAdapter } from '@fonderie/store';

// Single-use guard for native OAuth identity tokens. Unlike the web `code`
// exchange (which Apple/Google make one-time), a native identityToken is
// presented directly by the client, so without this it could be replayed until
// its exp. consumeOnce() records a hash of the token and reports whether THIS
// call was the first to consume it — an atomic INSERT ... ON CONFLICT DO
// NOTHING, so concurrent replays race safely (exactly one wins). Only a hash is
// stored, never the token.
export class ConsumedTokenModel {
	constructor(private store: IStoreAdapter) {}

	// True if the token had not been consumed before (caller may proceed); false
	// if this is a replay. `expiresAt` is the token's own exp — its TTL here.
	async consumeOnce(tokenHash: string, expiresAt: Date): Promise<boolean> {
		const rows = await this.store.query<{ token_hash: string }>(
			`INSERT INTO fonderie_consumed_tokens (token_hash, expires_at)
			 VALUES ($1, $2)
			 ON CONFLICT (token_hash) DO NOTHING
			 RETURNING token_hash`,
			[tokenHash, expiresAt],
		);
		return rows.length > 0;
	}

	// Opportunistic, fire-and-forget cleanup of expired rows (index-backed).
	// Recording history must never block or fail a login.
	sweepExpiredSafe(): void {
		void this.store
			.query(`DELETE FROM fonderie_consumed_tokens WHERE expires_at < now()`)
			.catch(() => {});
	}
}
