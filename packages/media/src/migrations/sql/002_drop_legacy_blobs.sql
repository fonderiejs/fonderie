-- ----------------------------------------------------------------------------
-- 002_drop_legacy_blobs
-- ----------------------------------------------------------------------------
-- Byte storage moved to @fonderie/storage (fonderie_storage_blobs) when the
-- providers were extracted from this package. media now stores bytes through an
-- injected IStorageProvider, so the old fonderie_media_blobs table (created by
-- 001_media) is superseded. Safe to drop — media@0.1.0 shipped without a wired
-- consumer, so nothing referenced it. Run @fonderie/storage's migration for the
-- replacement table.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS fonderie_media_blobs;
