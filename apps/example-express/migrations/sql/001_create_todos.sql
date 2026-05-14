CREATE TABLE IF NOT EXISTS todos (
	id         TEXT        PRIMARY KEY,
	user_id    TEXT        NOT NULL,
	text       TEXT        NOT NULL,
	done       BOOLEAN     NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
