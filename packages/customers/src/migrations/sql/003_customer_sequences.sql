CREATE TABLE IF NOT EXISTS fonderie_customer_sequences (
	workspace_id UUID NOT NULL,
	prefix       TEXT NOT NULL,
	next_val     BIGINT NOT NULL DEFAULT 1,
	PRIMARY KEY (workspace_id, prefix)
);
