-- ----------------------------------------------------------------------------
-- 001_media
-- ----------------------------------------------------------------------------
-- Asset storage for @fonderie/media. Two tables:
--
-- fonderie_media_assets — metadata for every stored asset. `storage_ref` is the
--   opaque handle the configured IStorageProvider returned from put(); the
--   provider alone knows how to resolve it back to bytes. Addressed publicly by
--   id via GET /media/:id. Not FK'd to any owner table because owner_type varies
--   (user / workspace / customer / …).
--
-- fonderie_media_blobs — bytes for the built-in DbBlobProvider (zero-infra
--   storage in Postgres). Untouched when an external provider (local-fs, S3) is
--   wired; storage_ref then points into that backend instead.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fonderie_media_assets (
	id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_type    TEXT        NOT NULL,
	owner_id      UUID        NOT NULL,
	purpose       TEXT        NOT NULL,
	content_type  TEXT        NOT NULL,
	byte_size     INTEGER     NOT NULL,
	storage_ref   TEXT        NOT NULL,
	created_by    UUID,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports "the current avatar/logo for this owner" lookups (latestFor).
CREATE INDEX IF NOT EXISTS idx_media_assets_owner
	ON fonderie_media_assets (owner_type, owner_id, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS fonderie_media_blobs (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	bytes       BYTEA       NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
