-- fonderie_subscriptions: replace workspace_id with polymorphic subscriber
ALTER TABLE fonderie_subscriptions
  ADD COLUMN subscriber_type TEXT,
  ADD COLUMN subscriber_id   UUID;

UPDATE fonderie_subscriptions
  SET subscriber_type = 'workspace',
      subscriber_id   = workspace_id;

ALTER TABLE fonderie_subscriptions
  ALTER COLUMN subscriber_type SET NOT NULL,
  ALTER COLUMN subscriber_id   SET NOT NULL;

ALTER TABLE fonderie_subscriptions
  DROP CONSTRAINT fonderie_subscriptions_workspace_id_key;

ALTER TABLE fonderie_subscriptions
  DROP COLUMN workspace_id;

ALTER TABLE fonderie_subscriptions
  ADD CONSTRAINT fonderie_subscriptions_subscriber_type_check
    CHECK (subscriber_type IN ('user', 'workspace')),
  ADD CONSTRAINT fonderie_subscriptions_subscriber_unique
    UNIQUE (subscriber_type, subscriber_id);

-- fonderie_usage_records: replace workspace_id with polymorphic subscriber
ALTER TABLE fonderie_usage_records
  ADD COLUMN subscriber_type TEXT,
  ADD COLUMN subscriber_id   UUID;

UPDATE fonderie_usage_records
  SET subscriber_type = 'workspace',
      subscriber_id   = workspace_id;

ALTER TABLE fonderie_usage_records
  ALTER COLUMN subscriber_type SET NOT NULL,
  ALTER COLUMN subscriber_id   SET NOT NULL;

ALTER TABLE fonderie_usage_records
  DROP COLUMN workspace_id;

ALTER TABLE fonderie_usage_records
  ADD CONSTRAINT fonderie_usage_records_subscriber_type_check
    CHECK (subscriber_type IN ('user', 'workspace'));

DROP INDEX IF EXISTS fonderie_usage_records_workspace_metric_idx;

CREATE INDEX fonderie_usage_records_subscriber_metric_idx
  ON fonderie_usage_records (subscriber_type, subscriber_id, metric, recorded_at);
