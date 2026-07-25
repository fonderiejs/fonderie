-- Secrets: the ConfigMap-vs-Secret split (k8s). Same lifecycle machinery as
-- config (version index, revisions, rollback, push propagation) but a SEPARATE
-- table + read path so a masking bug in config can't leak secrets. `value`
-- holds ciphertext when an encryptor is configured (plaintext under the no-op
-- default). Values are never returned by the masked admin reads — only the
-- explicit reveal path decrypts.

CREATE TABLE IF NOT EXISTS fonderie_secrets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  environment TEXT        NOT NULL DEFAULT 'all',
  description TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  version     INT         NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, environment)
);

CREATE TABLE IF NOT EXISTS fonderie_secret_revisions (
  key         TEXT        NOT NULL,
  environment TEXT        NOT NULL DEFAULT 'all',
  value       TEXT        NOT NULL,
  version     INT         NOT NULL,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, environment, version)
);

CREATE INDEX IF NOT EXISTS fonderie_secret_rev_key_env_idx
  ON fonderie_secret_revisions (key, environment, version DESC);
