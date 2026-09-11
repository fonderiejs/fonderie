-- Single-use guard for native OAuth identity tokens (POST /auth/apple/native).
-- Apple does not one-time the id_token for us the way the web `code` exchange
-- is single-use, so a captured native identityToken could otherwise be replayed
-- until its (short) exp. We record a HASH of each consumed token with the
-- token's own expiry as the TTL; the PRIMARY KEY makes consumption atomic
-- (concurrent replays race safely — exactly one wins), and expired rows are
-- swept opportunistically. Only the hash is stored — never the token itself.
CREATE TABLE IF NOT EXISTS fonderie_consumed_tokens (
	token_hash TEXT PRIMARY KEY,
	expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fonderie_consumed_tokens_expires
	ON fonderie_consumed_tokens (expires_at);
