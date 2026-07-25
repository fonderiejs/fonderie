-- Version index + revision history for email templates, on the shared
-- versioned-resource primitive (@fonderie/store). Each edit bumps `version`,
-- appends a revision, and can be rolled back. `locale` is nullable (NULL = the
-- base template), so the revisions uniqueness is a COALESCE index, not a PK
-- (a PRIMARY KEY can't span a nullable column).

ALTER TABLE fonderie_courier_templates
  ADD COLUMN IF NOT EXISTS version    INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE TABLE IF NOT EXISTS fonderie_courier_template_revisions (
  type       TEXT        NOT NULL,
  locale     TEXT,
  subject    TEXT,
  html       TEXT,
  text       TEXT        NOT NULL,
  version    INT         NOT NULL,
  actor      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fonderie_cct_rev_key_ver
  ON fonderie_courier_template_revisions (type, COALESCE(locale, ''), version);

CREATE INDEX IF NOT EXISTS fonderie_cct_rev_key
  ON fonderie_courier_template_revisions (type, COALESCE(locale, ''), version DESC);
