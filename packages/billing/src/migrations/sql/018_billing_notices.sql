-- Which threshold notices (credits low, usage limit warning / reached) a
-- subscriber has already been sent, and for which period.
--
-- The "send once" memory used to be a Set inside each API process, so every
-- instance behind a load balancer (and every serverless cold start) sent its
-- own copy of the same email. A row here is claimed with one conditional
-- statement before the notice goes out, so exactly one instance sends it.
--
-- One row per subscriber and notice: `period` is the window the notice was sent
-- for (a counter's reset time), so a new window re-arms it by overwriting the
-- row rather than adding one. The low-balance notice is re-armed by deleting
-- its row when the balance recovers.
--
-- Additive: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_billing_notices (
	subscriber_type  TEXT        NOT NULL,
	subscriber_id    UUID        NOT NULL,
	notice           TEXT        NOT NULL,
	period           TEXT        NOT NULL,
	sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_billing_notices_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	PRIMARY KEY (subscriber_type, subscriber_id, notice)
);
