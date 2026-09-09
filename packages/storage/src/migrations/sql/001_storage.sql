-- ----------------------------------------------------------------------------
-- 001_storage
-- ----------------------------------------------------------------------------
-- Byte storage for the built-in DbBlobProvider (zero-infra object storage in
-- Postgres). `bytes` holds an arbitrary object; the id is the opaque `ref` the
-- provider hands back and consumers persist. Untouched when an external
-- provider (local-fs, S3/MinIO) is wired — the ref then points into that
-- backend instead.
--
-- Deliberately content-agnostic: no content_type, no owner, no purpose. What an
-- object *is* and who owns it is the consumer's concern (e.g. @fonderie/media
-- keeps that in its own fonderie_media_assets table).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fonderie_storage_blobs (
	id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	bytes       BYTEA       NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
