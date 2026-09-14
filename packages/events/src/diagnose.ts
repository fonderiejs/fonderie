/**
 * Turn a drain failure into something that names its own most likely cause.
 *
 * Migrations run out of band, so a deploy routinely goes live ahead of them.
 * Publishing keeps working — it touches no new column — while every drain
 * fails on a column that does not exist yet. The raw error reads as "the queue
 * is broken"; the actual fix is one command, and nothing is lost in the
 * meantime because the rows are durable.
 *
 * Anything else is returned unchanged: guessing at causes you cannot see is
 * worse than saying what happened.
 */
export function explainDrainFailure(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	if (/column .* does not exist/i.test(message)) {
		return (
			`${message} — this deployment is ahead of its migrations. Run your migration ` +
			`step against this database; queued work is durable and delivers once it lands.`
		);
	}
	if (/relation .* does not exist/i.test(message)) {
		return (
			`${message} — @fonderie/events migrations have not been applied to this ` +
			`database. Run them, then drain again; nothing is lost in the meantime.`
		);
	}
	return message;
}

/**
 * Turn a LISTEN failure into something that names its own cause and both fixes.
 *
 * A transaction-mode pooler lends a backend per transaction and takes it back,
 * so a LISTEN registered on one is gone by the next statement. Poolers reject
 * it outright rather than pretend — but the raw error only says the statement
 * is unsupported, on a connection string that works everywhere else in the app.
 * The obvious reading is "the database is broken", which is the wrong place to
 * look.
 *
 * Both fixes are real and the choice matters, so both are named: point the
 * consumer at the session-mode endpoint (same database, same credentials), or
 * stop needing LISTEN at all by draining on a schedule — which is also what
 * lets the consumer run anywhere.
 */
export function explainListenFailure(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	return (
		`this transport is configured to CONSUME, which needs LISTEN — and LISTEN is not ` +
		`supported on this connection. That is the signature of a transaction-mode pooler ` +
		`(Supabase: port 6543). Either point this process at the session-mode connection ` +
		`instead (Supabase: port 5432, same database and credentials, different endpoint), ` +
		`or set \`consume: false\` and drain on a schedule — that issues no LISTEN and runs ` +
		`anywhere. Underlying error: ${message}`
	);
}
